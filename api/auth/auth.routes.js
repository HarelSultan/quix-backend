const express = require('express')
const { login, signup, logout, googleLoginSignup } = require('./auth.controller')

const router = express.Router()

router.post('/login', login)
router.post('/signup', signup)
router.post('/logout', logout)
router.post('/login/google', googleLoginSignup)

module.exports = router
