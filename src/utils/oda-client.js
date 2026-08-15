/**
 * Find the end of the JSON array/object that starts at `start`, respecting
 * string literals and escapes, then parse that slice.
 */
function parseJsonAt(text, start) {
  const open = text[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function collectFlightPayload(html) {
  const re = /self\.__next_f\.push\(/g;
  let payload = "";
  let m;

  while ((m = re.exec(html)) !== null) {
    let i = m.index + m[0].length;
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] !== "[") continue;

    const arr = parseJsonAt(html, i);
    if (Array.isArray(arr) && arr[0] === 1 && typeof arr[1] === "string") {
      payload += arr[1];
    }
  }
  return payload;
}

function collectDehydratedQueries(flight) {
  const re = /"queries"\s*:\s*\[/g;
  const queries = [];
  let m;

  while ((m = re.exec(flight)) !== null) {
    const arr = parseJsonAt(flight, m.index + m[0].length - 1);
    if (!Array.isArray(arr)) continue;
    queries.push(
      ...arr.filter((q) => q && typeof q === "object" && "queryKey" in q),
    );
  }
  return queries;
}

export function extractNextData(html) {
  const legacy = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (legacy) {
    try {
      return JSON.parse(legacy[1]);
    } catch {
      // Fall through
    }
  }

  const flight = collectFlightPayload(html);
  if (!flight) return null;

  const queries = collectDehydratedQueries(flight);
  if (queries.length === 0) return null;

  return { props: { pageProps: { dehydratedState: { queries } } } };
}

export function findDehydratedQuery(nextData, keyPrefix) {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
  for (const q of queries) {
    const key = q.queryKey;
    if (!Array.isArray(key) || key.length === 0) continue;
    const first = key[0];
    if (
      first === keyPrefix ||
      (typeof first === "object" && first?._id === keyPrefix)
    ) {
      return q.state?.data ?? null;
    }
  }
  return null;
}

function requireSearchData(url, nextData, kind, legacyKey) {
  if (!nextData) throw new Error(`No hydration state from ${url}`);
  const data = findDehydratedQuery(nextData, "mixedSearch") ?? findDehydratedQuery(nextData, legacyKey);
  if (!data || !Array.isArray(data.items)) throw new Error(`No ${kind} search results in ${url}`);
  return data;
}

export function parseProductPage(url, nextData) {
  const data = requireSearchData(url, nextData, "product", "searchpageresponse");
  const items = [];

  for (const item of data.items) {
    if (item.type !== "product") continue;
    const a = item.attributes;
    if (!a) continue;

    const unitPriceUnit = a.unitPriceQuantityAbbreviation || "";

    items.push({
      id: a.id || item.id,
      name: a.fullName || a.name || "Unknown",
      subtitle: a.nameExtra || "",
      price: parseFloat(a.grossPrice) || 0,
      relative_price: parseFloat(a.grossUnitPrice) || 0,
      relative_price_unit: unitPriceUnit ? `/${unitPriceUnit}` : "",
    });
  }

  return {
    page_url: url,
    items,
    has_more: data.attributes?.hasMoreItems === true,
  };
}

export class OdaClient {
  static BASE_URL = "https://oda.com/no";
  static API_BASE = "https://oda.com";
  static CART_API = "https://oda.com/api/v1/cart/";
  static CART_ITEMS_API = "https://oda.com/api/v1/cart/items/";

  constructor() {
    this.cookies = {};
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "no,nb;q=0.9,en;q=0.8",
    };
  }

  updateCookies(response) {
    const setCookieString = response.headers.get('set-cookie');
    if (!setCookieString) return;
    
    const cookiesArray = setCookieString.split(', ');
    
    for (const header of cookiesArray) {
      const parts = header.split(";")[0];
      const eq = parts.indexOf("=");
      if (eq > 0) {
        const name = parts.substring(0, eq).trim();
        const value = parts.substring(eq + 1).trim();
        this.cookies[name] = value;
      }
    }
  }

  cookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  getCsrfToken() {
    return this.cookies["csrftoken"] || null;
  }

  async getFollowRedirects(url) {
    const response = await fetch(url, {
      headers: {
        ...this.headers,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Cookie: this.cookieHeader(),
      },
      redirect: "follow",
    });
    this.updateCookies(response);
    return response;
  }

  async apiPost(url, body, referer) {
    const csrf = this.getCsrfToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.headers,
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: this.cookieHeader(),
        Origin: OdaClient.API_BASE,
        Referer: referer || `${OdaClient.BASE_URL}/`,
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    this.updateCookies(response);
    return response;
  }

  async fetchNextData(url) {
    const response = await this.getFollowRedirects(url);
    if (response.status === 425) {
      throw new Error("Server returned 425 Too Early.");
    }
    const html = await response.text();
    return extractNextData(html);
  }

  async searchProducts(query, page = 1) {
    const url = `${OdaClient.BASE_URL}/search/products/?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ""}`;
    const nextData = await this.fetchNextData(url);
    return parseProductPage(url, nextData);
  }

  async addToCart(productId, count = 1) {
    const response = await this.apiPost(
      OdaClient.CART_ITEMS_API,
      { items: [{ product_id: productId, quantity: count }] }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Add to cart failed: HTTP ${response.status}${body ? ` – ${body.slice(0, 500)}` : ""}`);
    }
  }

  async login(email, password) {
    await this.getFollowRedirects(`${OdaClient.BASE_URL}/user/login/`);
    const response = await this.apiPost(
      `${OdaClient.API_BASE}/api/v1/user/login/`,
      { username: email, password },
      `${OdaClient.BASE_URL}/user/login/`
    );
    if (response.ok) return true;
    return false;
  }

  isAuthenticated() {
    return !!this.cookies["sessionid"];
  }
}
