export default function manifest() {
  return {
    name: 'Souschef',
    short_name: 'Souschef',
    description: 'Din personlige AI-kokk i lomma',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#10b981',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
