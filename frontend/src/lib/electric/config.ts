import { oauthApi } from '../api';
import { REMOTE_API_URL } from '../remoteApi';

/**
 * Creates authenticated shape options for Electric SQL shapes.
 * Used by simpler collections that don't need mutation support.
 */
export function createAuthenticatedShapeOptions(table: string) {
  return {
    url: `${REMOTE_API_URL}/shape/${table}`,
    headers: {
      Authorization: async () => {
        const tokenResponse = await oauthApi.getToken();
        return tokenResponse ? `Bearer ${tokenResponse.access_token}` : '';
      },
    },
    parser: {
      timestamptz: (value: string) => value,
    },
  };
}
