import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: import.meta.env.KEYCLOAK_URL,
  realm: import.meta.env.KEYCLOAK_REALM,
  clientId: import.meta.env.KEYCLOAK_CLIENT_ID,
})

export default keycloak
