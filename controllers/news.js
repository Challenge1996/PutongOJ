const News = require('../models/News')
const Ids = require('../models/ID')
const { extractPagination, isUndefined } = require('../utils')

/** 返回新闻列表 */
async function queryList (ctx, next) {
  const res = await News
    .paginate({}, {
      limit: +ctx.query.limit || 30, // 加号表示使其变为数字
      page: +ctx.query.page || 1,
      sort: {cid: 1},
      // '-_id' 结果不包含 _id
      // http://stackoverflow.com/questions/9598505/mongoose-retrieving-data-without-id-field
      select: '-_id title nid status create'
    })

  ctx.body = {
    news: res.docs,
    pagination: extractPagination(res)
  }
}

/** 指定nid, 返回一条具体的新闻 */
async function queryOneNews (ctx, next) {
  const nid = +ctx.params.nid

  if (isNaN(nid)) {
    ctx.throw(400, 'Nid should be a number')
  }

  const news = await News
    .findOne({nid})
    .select('-_id title nid status create content')
    .exec()

  if (!news) {
    ctx.throw(400, 'No such a problem')
  }

  ctx.body = {
    news
  }
}

/** 创造一个新的 News */
async function create (ctx, next) {
  const { title, content } = ctx.request.body

  if (isUndefined(title)) {
    ctx.throw(400, 'Title should not be empty')
  } else if (isUndefined(content)) {
    ctx.throw(400, 'Content should not be empty')
  }

  const verified = News.validate(ctx.request.body)

  if (!verified.valid) {
    ctx.throw(400, verified.error)
  }

  const nid = await Ids.generateId('News')

  const news = new News({
    nid, title, content
  })

  news.save()

  ctx.body = { nid, title, content }
}

/** 指定nid, 更新一个已存在的 News */
async function update (ctx, next) {
  const verified = News.validate(ctx.request.body)
  if (!verified.valid) {
    ctx.throw(400, verified.error)
  }

  const nid = +ctx.params.nid
  if (isNaN(nid)) {
    ctx.throw(400, 'Nid should be a number')
  }

  const news = await News
    .findOne({nid})
    .exec()

  if (!news) {
    ctx.throw(400, 'No such a news')
  }

  for (let field of ['title', 'content']) {
    if (!isUndefined(ctx.request.body[field])) {
      news[field] = ctx.request.body[field]
    }
  }

  await news.save()

  const { title, content } = news
  ctx.body = {
    news: { nid, title, content }
  }
}

async function del (ctx, next) {
  const nid = +ctx.params.nid
  const news = await News
    .findOne({nid})
    .exec()

  if (!news) {
    ctx.throw(400, 'No such a news')
  }

  await News.deleteOne({nid}).exec()
  ctx.body = {}
}

module.exports = {
  queryList,
  queryOneNews,
  create,
  update,
  del
}
