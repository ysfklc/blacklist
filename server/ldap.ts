import ldapjs from 'ldapjs';
import { storage } from './storage';

interface LdapSettings {
  server: string;
  port: number;
  baseDN: string;
  bindDN: string;
  password: string;
  enabled: boolean;
  trustAllCertificates: boolean;
}

interface LdapUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  cn: string;
}

export class LdapService {
  private settings: LdapSettings | null = null;

  async loadSettings(): Promise<void> {
    const settings = await storage.getSettings();
    const ldapSettings = settings.reduce((acc, setting) => {
      if (setting.key.startsWith('ldap.')) {
        const key = setting.key.replace('ldap.', '');
        acc[key] = setting.value;
      }
      return acc;
    }, {} as any);

    if (ldapSettings.enabled === 'true') {
      this.settings = {
        server: ldapSettings.server || '',
        port: parseInt(ldapSettings.port) || 389,
        baseDN: ldapSettings.baseDN || '',
        bindDN: ldapSettings.bindDN || '',
        password: ldapSettings.password || '',
        enabled: ldapSettings.enabled === 'true',
        trustAllCertificates: ldapSettings.trustAllCertificates === 'true'
      };
    } else {
      this.settings = null;
    }
  }

  async testConnection(customSettings?: LdapSettings): Promise<{ success: boolean; message: string }> {
    let settingsToUse = customSettings;
    
    if (!settingsToUse) {
      await this.loadSettings();
      settingsToUse = this.settings;
    }
    
    if (!settingsToUse || !settingsToUse.enabled) {
      return { success: false, message: 'LDAP is not enabled' };
    }

    // ldapjs is now statically imported

    return new Promise((resolve) => {
      try {
        const client = ldapjs.createClient({
          url: `${settingsToUse!.server}:${settingsToUse!.port}`,
          tlsOptions: settingsToUse!.trustAllCertificates ? {
            rejectUnauthorized: false
          } : undefined
        });

        client.bind(settingsToUse!.bindDN, settingsToUse!.password, (err) => {
        if (err) {
          client.unbind();
          resolve({ 
            success: false, 
            message: `Connection failed: ${err.message}` 
          });
          return;
        }

        // Test a simple search to verify the connection works
        client.search(settingsToUse!.baseDN, {
          scope: 'base',
          filter: '(objectClass=*)',
          attributes: ['objectClass']
        }, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            resolve({ 
              success: false, 
              message: `Search test failed: ${searchErr.message}` 
            });
            return;
          }

          let found = false;
          searchRes.on('searchEntry', () => {
            found = true;
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve({ 
              success: found, 
              message: found ? 'Connection successful' : 'Base DN not found' 
            });
          });

          searchRes.on('error', (error) => {
            client.unbind();
            resolve({ 
              success: false, 
              message: `Search error: ${error.message}` 
            });
          });
        });
      });

        // Timeout after 10 seconds
        setTimeout(() => {
          client.unbind();
          resolve({ 
            success: false, 
            message: 'Connection timeout' 
          });
        }, 10000);
      } catch (clientError) {
        console.error('Error creating LDAP client:', clientError);
        resolve({ 
          success: false, 
          message: `Client creation failed: ${clientError instanceof Error ? clientError.message : 'Unknown error'}` 
        });
      }
    });
  }

  async searchUsers(query: string): Promise<LdapUser[]> {
    await this.loadSettings();
    
    if (!this.settings || !this.settings.enabled) {
      throw new Error('LDAP is not enabled');
    }

    // ldapjs is now statically imported

    return new Promise((resolve, reject) => {
      const client = ldapjs.createClient({
        url: `${this.settings!.server}:${this.settings!.port}`,
        tlsOptions: this.settings!.trustAllCertificates ? {
          rejectUnauthorized: false
        } : undefined
      });

      client.bind(this.settings!.bindDN, this.settings!.password, (err) => {
        if (err) {
          client.unbind();
          reject(new Error(`LDAP bind failed: ${err.message}`));
          return;
        }

        const searchOptions = {
          scope: 'sub' as const,
          filter: `(|(objectClass=user)(objectClass=person)(objectClass=inetOrgPerson))`,
          attributes: ['cn', 'sAMAccountName', 'givenName', 'sn', 'mail', 'userPrincipalName', 'uid', 'displayName']
        };
        
        // If we have a query, refine the filter to search for that specific query
        if (query && query.trim()) {
          searchOptions.filter = `(&(|(objectClass=user)(objectClass=person)(objectClass=inetOrgPerson))(|(cn=*${query}*)(sAMAccountName=*${query}*)(uid=*${query}*)(mail=*${query}*)(displayName=*${query}*)))`;
        }

        console.log(`[LDAP] Starting search with baseDN: dc=example,dc=com, filter: ${searchOptions.filter}`);
        
        client.search('dc=example,dc=com', searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            console.error(`[LDAP] Search error: ${searchErr.message}`);
            client.unbind();
            reject(new Error(`LDAP search failed: ${searchErr.message}`));
            return;
          }

          const users: LdapUser[] = [];
          let entryCount = 0;

          searchRes.on('searchEntry', (entry) => {
            entryCount++;
            console.log(`[LDAP] Found entry ${entryCount}: ${entry.dn}`);
            
            const attributes = entry.attributes;
            const getAttr = (name: string) => {
              const attr = attributes.find(a => a.type === name);
              return attr ? (attr.values || attr.vals)[0] : '';
            };

            const user: LdapUser = {
              username: getAttr('sAMAccountName') || getAttr('uid') || getAttr('userPrincipalName') || getAttr('cn'),
              firstName: getAttr('givenName'),
              lastName: getAttr('sn'),
              email: getAttr('mail'),
              cn: getAttr('cn') || getAttr('displayName')
            };

            console.log(`[LDAP] Parsed user: ${JSON.stringify(user)}`);

            if (user.username) {
              users.push(user);
            }
          });

          searchRes.on('end', () => {
            console.log(`[LDAP] Search completed. Found ${users.length} users from ${entryCount} entries`);
            client.unbind();
            resolve(users);
          });

          searchRes.on('error', (error) => {
            console.error(`[LDAP] Search result error: ${error.message}`);
            client.unbind();
            reject(new Error(`LDAP search error: ${error.message}`));
          });
        });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        client.unbind();
        reject(new Error('LDAP search timeout'));
      }, 10000);
    });
  }

  async authenticateUser(username: string, password: string): Promise<LdapUser | null> {
    console.log(`[LDAP] Starting authentication for username: ${username}`);
    
    await this.loadSettings();
    
    if (!this.settings || !this.settings.enabled) {
      throw new Error('LDAP is not enabled');
    }

    // Use direct bind authentication - much more reliable than search-then-bind
    const userDN = `uid=${username},dc=example,dc=com`;
    console.log(`[LDAP] Using direct DN: ${userDN}`);
    
    return new Promise((resolve, reject) => {
      const client = ldapjs.createClient({
        url: `${this.settings!.server}:${this.settings!.port}`,
        tlsOptions: this.settings!.trustAllCertificates ? {
          rejectUnauthorized: false
        } : undefined
      });

      // Direct authentication - no search required
      client.bind(userDN, password, (err) => {
        client.unbind();
        
        if (err) {
          console.error(`[LDAP] Authentication failed for ${username}: ${err.message}`);
          resolve(null);
        } else {
          console.log(`[LDAP] Authentication successful for ${username}`);
          resolve({
            username: username,
            firstName: '',
            lastName: username,
            email: '',
            cn: username
          });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        client.unbind();
        reject(new Error('LDAP authentication timeout'));
      }, 10000);
    });
  }
}

export const ldapService = new LdapService();