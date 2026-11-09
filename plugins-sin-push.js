// Las apps instaladas con AltStore y un Apple ID gratuito no pueden llevar el permiso de
// notificaciones push. Lo quitamos para que la firma no falle (los avisos locales siguen funcionando).
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function sinPush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
