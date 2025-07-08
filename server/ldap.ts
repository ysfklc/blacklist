// Import ldapjs with fallback compatibility
let ldapjs: any;
try {
  // Try CommonJS require first
  ldapjs = require('ldapjs');
} catch (e) {
  console.error('Failed to require ldapjs, trying dynamic import:', e);
}
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

    // Try dynamic import if ldapjs is not available
    if (!ldapjs) {
      try {
        ldapjs = await import('ldapjs');
        ldapjs = ldapjs.default || ldapjs;
      } catch (e) {
        return { success: false, message: 'LDAP module not available' };
      }
    }

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

    // Try dynamic import if ldapjs is not available
    if (!ldapjs) {
      try {
        ldapjs = await import('ldapjs');
        ldapjs = ldapjs.default || ldapjs;
      } catch (e) {
        throw new Error('LDAP module not available');
      }
    }

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
          filter: `(&(objectClass=user)(|(cn=*${query}*)(sAMAccountName=*${query}*)(mail=*${query}*)))`,
          attributes: ['cn', 'sAMAccountName', 'givenName', 'sn', 'mail', 'userPrincipalName']
        };

        client.search(this.settings!.baseDN, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            reject(new Error(`LDAP search failed: ${searchErr.message}`));
            return;
          }

          const users: LdapUser[] = [];

          searchRes.on('searchEntry', (entry) => {
            const attributes = entry.attributes;
            const getAttr = (name: string) => {
              const attr = attributes.find(a => a.type === name);
              return attr ? attr.vals[0] : '';
            };

            const user: LdapUser = {
              username: getAttr('sAMAccountName') || getAttr('userPrincipalName'),
              firstName: getAttr('givenName'),
              lastName: getAttr('sn'),
              email: getAttr('mail'),
              cn: getAttr('cn')
            };

            if (user.username) {
              users.push(user);
            }
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(users);
          });

          searchRes.on('error', (error) => {
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
    await this.loadSettings();
    
    if (!this.settings || !this.settings.enabled) {
      throw new Error('LDAP is not enabled');
    }

    // Try dynamic import if ldapjs is not available
    if (!ldapjs) {
      try {
        ldapjs = await import('ldapjs');
        ldapjs = ldapjs.default || ldapjs;
      } catch (e) {
        throw new Error('LDAP module not available');
      }
    }

    return new Promise((resolve, reject) => {
      const client = ldapjs.createClient({
        url: `${this.settings!.server}:${this.settings!.port}`,
        tlsOptions: this.settings!.trustAllCertificates ? {
          rejectUnauthorized: false
        } : undefined
      });

      // First, find the user's DN
      client.bind(this.settings!.bindDN, this.settings!.password, (err) => {
        if (err) {
          client.unbind();
          reject(new Error(`LDAP bind failed: ${err.message}`));
          return;
        }

        const searchOptions = {
          scope: 'sub' as const,
          filter: `(&(objectClass=user)(|(sAMAccountName=${username})(userPrincipalName=${username})))`,
          attributes: ['cn', 'sAMAccountName', 'givenName', 'sn', 'mail', 'userPrincipalName', 'distinguishedName']
        };

        client.search(this.settings!.baseDN, searchOptions, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            reject(new Error(`LDAP search failed: ${searchErr.message}`));
            return;
          }

          let userDN: string | null = null;
          let userInfo: LdapUser | null = null;

          searchRes.on('searchEntry', (entry) => {
            const attributes = entry.attributes;
            const getAttr = (name: string) => {
              const attr = attributes.find(a => a.type === name);
              return attr ? attr.vals[0] : '';
            };

            userDN = getAttr('distinguishedName');
            userInfo = {
              username: getAttr('sAMAccountName') || getAttr('userPrincipalName'),
              firstName: getAttr('givenName'),
              lastName: getAttr('sn'),
              email: getAttr('mail'),
              cn: getAttr('cn')
            };
          });

          searchRes.on('end', () => {
            if (!userDN || !userInfo) {
              client.unbind();
              resolve(null);
              return;
            }

            // Now try to authenticate with the user's credentials
            const authClient = ldapjs.createClient({
              url: `${this.settings!.server}:${this.settings!.port}`,
              tlsOptions: this.settings!.trustAllCertificates ? {
                rejectUnauthorized: false
              } : undefined
            });

            authClient.bind(userDN, password, (authErr) => {
              authClient.unbind();
              client.unbind();
              
              if (authErr) {
                resolve(null);
              } else {
                resolve(userInfo);
              }
            });
          });

          searchRes.on('error', (error) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${error.message}`));
          });
        });
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