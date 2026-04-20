import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from '../config/index.js'

const plugin: FastifyPluginAsync = async (app) => {
  const JWKS = createRemoteJWKSet(
    new URL(`${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`)
  )

  // Override default JWT verify to use Keycloak JWKS
  app.decorate('verifyKeycloakToken', async (token: string) => {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer:   `${config.keycloak.url}/realms/${config.keycloak.realm}`,
      audience: config.keycloak.clientId,
    })
    return payload
  })
}

export const authPlugin = fp(plugin, { name: 'auth' })
