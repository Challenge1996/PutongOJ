require('./config/db')
const { resolve } = require('path')
const fse = require('fs-extra')
const range = require('lodash.range')
const shell = require('shelljs')
const ID = require('./models/ID')
const config = require('./config')

// download and initialize the judgers
// start !

const logDir = resolve(__dirname, 'logs')

const baseConfig = {
  apps: [
    {
      name: 'app',
      script: resolve(__dirname, `app.js`),
      'out_file': resolve(logDir, `app.out.log`),
      'error_file': resolve(logDir, `app.err.log`),
      'log_date_format': 'YYYY-MM-DD HH:mm:ss X',
      'merge_logs': true,
      env: {
        'NODE_ENV': 'production'
      }
    },
    {
      name: 'updater',
      script: resolve(__dirname, 'judgers', `updater.js`),
      'out_file': resolve(logDir, `updater.out.log`),
      'error_file': resolve(logDir, `updater.err.log`),
      'log_date_format': 'YYYY-MM-DD HH:mm:ss X',
      'merge_logs': true
    }
  ]
}

async function judgeSetup () {
  let judgers = +config.judgers
  if (!(judgers >= 1 && judgers <= 10)) judgers = 1

  const judgersDir = resolve(__dirname, 'judgers')

  // 下载最新版的 judger
  shell.exec(`git clone 'https://github.com/acm309/Judger' ${resolve(judgersDir, 'Judger')}`)
  shell.exec(`make -C ${resolve(judgersDir, 'Judger')}`)

  await Promise.all([
    fse.copy(resolve(judgersDir, 'Judger', 'Judge'), resolve(judgersDir, 'node-0', 'Judge')),
    fse.copy(resolve(judgersDir, 'Judger', 'config.ini'), resolve(judgersDir, 'node-0', 'config.ini'))
  ])

  await Promise.all(
    range(1, judgers)
      .map(i => fse.copy(
        resolve(judgersDir, 'node-0'),
        resolve(judgersDir, `node-${i}`)
      ))
  )

  const pm2config = baseConfig

  range(judgers).forEach(i =>
    pm2config.apps.push({
      name: `node-${i}`,
      script: resolve(judgersDir, `node-${i}/judger.js`),
      'out_file': resolve(logDir, `node-${i}-out.log`),
      'error_file': resolve(logDir, `node-${i}-err.log`),
      'log_date_format': 'YYYY-MM-DD HH:mm:ss X',
      'merge_logs': true
    })
  )

  return fse.outputJSON('pm2.config.json', pm2config, { spaces: 2, EOL: '\n' })
}

async function databaseSetup () {
  const models = [
    'Problem', 'Solution', 'Contest', 'News', 'Group'
  ]
  return Promise.all(models.map(async (model) => {
    const item = await ID.findOne({ name: model }).exec()
    if (item != null && item.id >= 0) return
    return new ID({ name: model, id: 0 }).save()
  }))
}

async function main () {
  return Promise.all([
    judgeSetup(),
    databaseSetup()
  ])
}

main()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })
