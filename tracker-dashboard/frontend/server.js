import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const app = express()
const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

// Serve static files from the dist/ folder
app.use(express.static(join(__dirname, 'dist')))

// SPA fallback: if a route is not found, serve index.html (React Router will handle it)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`)
})
