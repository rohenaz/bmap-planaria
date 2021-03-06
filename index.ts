import * as chalk from 'chalk'
import { fork } from 'child_process'
import * as net from 'net'
import * as redline from 'readline'
import { crawler, setCurrentBlock } from './crawler'
import { closeDb } from './db'
import { ensureEnvVars } from './env'
import { getCurrentBlock } from './state'

/* Bitsocket runs in a child process */

const bitsocket = fork('./build/bitsocket')

/* Planarium (API Server Process) */
const planarium = fork('./build/planarium')

// Open up the server and send RPC socket to child. Use pauseOnConnect to prevent
// the sockets from being read before they are sent to the child process.
const server = net.createServer({ pauseOnConnect: true })
server.on('connection', (socket) => {
  planarium.send('socket', socket)
})
server.listen(1336)

const start = async () => {
  await ensureEnvVars()

  try {
    // Should really start with latest blk from ANY collection, not only video like this
    let currentBlock = await getCurrentBlock()
    setCurrentBlock(currentBlock)
    console.log(chalk.cyan('crawling from', currentBlock))
    crawler(() => {
      bitsocket.send({ connect: true })
    })
  } catch (e) {
    console.error(e)
  }
}

// Handle interrupt
if (process.platform === 'win32') {
  let rl = redline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.on('SIGINT', function () {
    // ToDo - TS hates this
    // process.emit('SIGINT')
  })
}

process.on('SIGINT', async function () {
  // graceful shutdown
  console.log('close from shutdown')
  closeDb()
  server.close()
  process.exit()
})

console.log(
  chalk.yellow(`
:::::::::  ::::    ::::      :::     :::::::::  
  :+:    :+: +:+:+: :+:+:+   :+: :+:   :+:    :+: 
  +:+    +:+ +:+ +:+:+ +:+  +:+   +:+  +:+    +:+ 
  +#++:++#+  +#+  +:+  +#+ +#++:++#++: +#++:++#+  
  +#+    +#+ +#+       +#+ +#+     +#+ +#+        
  #+#    #+# #+#       #+# #+#     #+# #+#        
  #########  ###       ### ###     ### ###
`)
)

setTimeout(start, 1000)
