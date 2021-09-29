/* eslint-disable linebreak-style */
/* eslint-disable no-console */
const http = require('http');
const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const fs = require('fs');
const uuid = require('uuid');
const WS = require('ws');

const fetch = require('node-fetch');

const app = new Koa();

const public = path.join(__dirname, '/public')
app.use(koaStatic(public));

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

const router = new Router();
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });

const arrayMessages = [];

let initMessage = false;

router.get('/init', async (ctx, next) => {
  if (!initMessage) {
    initMessage = true;
    const responseFetch = await fetch('https://ahj-diplom-backend.herokuapp.com/msg.json');
    /* const responseFetch = await fetch('http://localhost:7070/msg.json'); */
    const body = await responseFetch.text();
    const arrayInitMessage = JSON.parse(body);
    arrayMessages.push(...arrayInitMessage);
    ctx.response.body = arrayMessages[0];
  }
  ctx.response.body = 'ok';
});

router.get('/messagesArray', async (ctx, next) => {
  console.log('get messages');
  ctx.response.body = arrayMessages;
});

router.get('/msg/:numb', async (ctx, next) => {
  console.log('get number of message', ctx.params.numb);
  const messagesLength = arrayMessages.length - ctx.params.numb;
  const messagesStart = (messagesLength - 10) < 0 ? 0 : (messagesLength - 10);
  const messagesReturn = arrayMessages.slice(messagesStart, messagesLength).reverse();
  ctx.response.body = messagesReturn;
});

router.post('/favoriteMessage', async (ctx, next) => {
  const messageObject = JSON.parse(ctx.request.body);
  const messageIndex = arrayMessages.findIndex((item) => JSON.parse(item).id === messageObject.id);
  arrayMessages[messageIndex].favorite = messageObject.value;
  const obj = {
    type: 'favoriteMessage',
    id: messageObject.id,
    value: messageObject.value,
  };
  ctx.response.status = 204
});

wsServer.on('connection', (ws, req) => {
  console.log('Server connected');
  ws.on('message', (msg) => {
    arrayMessages.push(msg);

    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(msg));
  });

  ws.on('close', (msg) => {
    console.log('Server closed');
    [...wsServer.clients]

    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(JSON.stringify({type: 'delete user'})));
    ws.close();
  });

  [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(JSON.stringify({type: 'add user'})));

});

app.use(router.routes()).use(router.allowedMethods());
const port = process.env.PORT || 7070;
server.listen(port);