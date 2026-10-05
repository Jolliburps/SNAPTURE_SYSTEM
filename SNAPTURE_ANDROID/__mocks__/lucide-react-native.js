module.exports = new Proxy({ __esModule: true }, {
  get(target, name) {
    if (name in target) return target[name];
    return () => null;
  },
});
