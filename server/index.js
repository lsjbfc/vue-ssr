const fs = require('fs')
const path = require('path')
const express = require('express')
const favicon = require('serve-favicon')
const resolve = file => path.resolve(__dirname, file)
const LRU = require('lru-cache')
// const isProd = process.env.NODE_ENV === 'production'

const app = express()

let renderer
const bundle = require('./static/vue-ssr-bundle.json')
const template = fs.readFileSync(resolve('./static/index.html'), 'utf-8')
renderer = createRenderer(bundle, template)

function createRenderer (bundle, template) {
  // https://github.com/vuejs/vue/blob/dev/packages/vue-server-renderer/README.md#why-use-bundlerenderer
  return require('vue-server-renderer').createBundleRenderer(bundle, {
    template,
    cache: LRU({
      max: 1000,
      maxAge: 1000 * 60 * 15
    })
  })
}

const serve = (path, cache) => express.static(resolve(path), {
  maxAge:  60 * 60 * 24 * 30
})

app.use('/', serve('./static', true))
app.use(favicon(path.resolve(__dirname, './static/logo.png')))
app.use('/service-worker.js', serve('./static/service-worker.js'))

app.get('*', (req, res) => {
  if (!renderer) {
    return res.end('waiting for compilation... refresh in a moment.')
  }

  const s = Date.now()

  res.setHeader('Content-Type', 'text/html')

  const errorHandler = err => {
    if (err && err.code === 404) {
      res.status(404).end('404 | Page Not Found')
    } else {
      // Render Error Page or Redirect
      res.status(500).end('500 | Internal Server Error')
      console.error(`error during render : ${req.url}`)
      console.error(err)
    }
  }

  renderer.renderToStream({ url: req.url })
    .on('error', errorHandler)
    .on('end', () => console.log(`whole request: ${Date.now() - s}ms`))
    .pipe(res)
})

const port = process.env.PORT || 9009
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`)
})
