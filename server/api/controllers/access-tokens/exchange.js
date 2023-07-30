const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const openidClient = require('openid-client');
const { getRemoteAddress } = require('../../../utils/remoteAddress');

const Errors = {
  INVALID_TOKEN: {
    invalidToken: 'Invalid email or username',
  },
};

const jwks = jwksClient({
  jwksUri: 'https://auth.jjakt.monster/realms/test-realm/protocol/openid-connect/certs',
  requestHeaders: {}, // Optional
  timeout: 30000, // Defaults to 30s
});

const getJwtVerificationOptions = () => {
  const options = {};
  if (sails.config.custom.oidcIssuer) {
    options.issuer = sails.config.custom.oidcIssuer;
  }
  if (sails.config.custom.oidcAudience) {
    options.audience = sails.config.custom.oidcAudience;
  }
  return options;
};

const validateAndDecodeToken = async (accessToken, options) => {
  sails.log.info(accessToken);
  const keys = await jwks.getSigningKeys();
  let validToken = {};

  const isTokenValid = keys.some((signingKey) => {
    try {
      const key = signingKey.getPublicKey();
      validToken = jwt.verify(accessToken, key, options);
      return 'true';
    } catch (error) {
      sails.log.error(error);
    }
    return false;
  });

  if (!isTokenValid) {
    const tokenForLogging = jwt.decode(accessToken);
    const remoteAddress = getRemoteAddress(this.req);

    sails.log.warn(
      `invalid token: sub: "${tokenForLogging.sub}" issuer: "${tokenForLogging.iss}" audience: "${tokenForLogging.aud}" exp: ${tokenForLogging.exp} (IP: ${remoteAddress})`,
    );
    throw Errors.INVALID_TOKEN;
  }
  return validToken;
};

const getUserInfo = async (accessToken, options) => {
  const issuer = await openidClient.Issuer.discover(options.issuer);
  const oidcClient = new issuer.Client({
    client_id: 'irrelevant',
  });
  const userInfo = await oidcClient.userinfo(accessToken);
  return userInfo;
};
const mergeUserData = (validToken, userInfo) => {
  const oidcUser = { ...validToken, ...userInfo };
  sails.log.info(oidcUser);
  return oidcUser;
};
module.exports = {
  inputs: {
    token: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    invalidToken: {
      responseType: 'unauthorized',
    },
  },

  async fn(inputs) {
    const options = getJwtVerificationOptions();
    const validToken = await validateAndDecodeToken(inputs.token, options);
    const userInfo = await getUserInfo(inputs.token, options);
    const oidcUser = mergeUserData(validToken, userInfo);

    const now = new Date();
    let isAdmin = false;
    if (sails.config.custom.oidcAdminRoles.includes('*')) isAdmin = true;
    else if (Array.isArray(oidcUser[sails.config.custom.oidcRolesAttribute])) {
      const userRoles = new Set(oidcUser[sails.config.custom.oidcRolesAttribute]);
      isAdmin = sails.config.custom.oidcAdminRoles.findIndex((role) => userRoles.has(role)) > -1;
    }

    const newUser = {
      email: oidcUser.email,
      password: '$sso$', // Prohibit password login for SSO accounts
      isAdmin,
      name: oidcUser.name,
      username: oidcUser.preferred_username,
      subscribeToOwnCards: false,
      createdAt: now,
      updatedAt: now,
    };

    const user = await User.findOrCreate({ username: userInfo.preferred_username }, newUser);

    const controlledFields = ['email', 'password', 'isAdmin', 'name', 'username'];
    const updateFields = {};
    controlledFields.forEach((field) => {
      if (user[field] !== newUser[field]) {
        updateFields[field] = newUser[field];
      }
    });

    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = now;
      await User.updateOne({ id: user.id }).set(updateFields);
    }

    const plankaToken = sails.helpers.utils.createToken(user.id);

    const remoteAddress = getRemoteAddress(this.req);
    await Session.create({
      accessToken: plankaToken,
      remoteAddress,
      userId: user.id,
      userAgent: this.req.headers['user-agent'],
    });

    return {
      item: plankaToken,
    };
  },
};
