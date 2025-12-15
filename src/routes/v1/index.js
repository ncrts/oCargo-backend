const express = require('express');
const commonRoute = require('./common.route');
const playerRoute = require('./player.route');
const franchiseeRoute = require('./franchisee.route');
const franchisorRoute = require('./franchisor.route');
const quizGameRoute = require('./quiz.game.route');
const talentShowRoute = require('./talent.show.route');


const router = express.Router();

const defaultRoutes = [
  {
    path: '/common',
    route: commonRoute,
  },
  {
    path: '/player',
    route: playerRoute,
  },
  {
    path: '/franchisee',
    route: franchiseeRoute,
  },
  {
    path: '/franchisor',
    route: franchisorRoute,
  },
  {
    path: '/quiz-game',
    route: quizGameRoute,
  },
  {
    path: '/talent-show',
    route: talentShowRoute,
  }
]

/*
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
{
  path: '/auth',
    route: authRoute,
  },
{
  path: '/user',
  route: userRoute,
}*/

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;