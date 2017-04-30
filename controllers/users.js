const User = require('../models/User')
const Solution = require('../models/Solution')
const _ = require('ramda')
const { generatePwd, isUndefined } = require('../utils')

async function queryOneUser (ctx, next) {
  const uid = ctx.params.uid

  const user = await User
    .findOne({uid})
    .select('-_id uid nick solve submit status timerecord iprecord school mail motto privilege')
    .lean()
    .exec()

  if (!user) {
    ctx.throw(400, 'No such a user')
  }

  let solved = await Solution
    .find({uid, judge: 3}) // TODO: fix this number to a constant variable
    .distinct('pid')
    .exec()

  solved = _.sort((x, y) => (x < y ? -1 : 1), solved)

  let unsolved = await Solution
    .find({uid, judge: {$ne: 3}}) // TODO: fix this number to a constant variable
    .distinct('pid')
    .exec()

  unsolved = _.filter((pid) => !solved.includes(pid), unsolved)

  ctx.body = {
    user,
    solved,
    unsolved
  }
}

async function register (ctx, next) {
  const { uid, nick, pwd } = ctx.request.body

  ;['uid', 'nick', 'pwd'].forEach((item) => {
    if (!ctx.request.body[item]) {
      ctx.throw(400, `Field "${item}" is needed!`)
    }
  })

  const verified = User.validate(ctx.request.body)

  if (!verified.valid) {
    ctx.throw(400, verified.error)
  }

  const uidExist = await User
    .count({uid})
    .exec()

  if (uidExist) {
    ctx.throw(400, `Oh no, username "${uid}" has been used by others.`)
  }

  const user = new User({
    uid,
    nick,
    pwd: generatePwd(pwd)
  })

  user.updateRecords(ctx.ip, Date.now())

  await user.save()

  ctx.body = {
    user: {
      uid,
      nick,
      privilege: user.privilege
    }
  }
}

// TODO: 检查发出更新请求的用户是否与待更新的用户属于同一个
// TODO: 如果发出请求的用户的权限较高，可更改其它用户的信息
async function update (ctx, next) {
  const uid = ctx.params.uid

  const user = await User
    .findOne({uid})
    .exec()

  if (!user) {
    ctx.throw(400, 'No such a user')
  }

  const verified = User.validate(ctx.request.body)
  if (!verified.valid) {
    ctx.throw(400, verified.error)
  }

  if (!isUndefined(ctx.request.body['pwd'])) {
    ctx.request.body.pwd = generatePwd(ctx.request.body.pwd)
  }
  // 可更新的字段
  const fields = ['nick', 'pwd', 'school', 'mail', 'motto']
  fields.forEach((item) => {
    if (!isUndefined(ctx.request.body[item])) {
      user[item] = ctx.request.body[item]
    }
  })

  await user.save()

  const { nick, privilege, school, mail, motto } = user
  ctx.body = {
    uid, nick, privilege, school, mail, motto
  }
}

module.exports = {
  queryOneUser,
  register,
  update
}
