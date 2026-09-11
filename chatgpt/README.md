# Parity checker: all ChatGPT packages vs live MVP routes.

Checks every package (candidate/manager/tech): operations declared,
route files exist, auth helper referenced by each mapped route file,
instructions present with leak-guards. Run: node chatgpt/parity-check.mjs
Covers the auth gap honestly: a route without verifyActionsKey FAILS.
