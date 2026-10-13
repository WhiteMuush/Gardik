import { Code, Step, Sub, Warning } from "./parts"

export function LdapGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gardik connects directly to your LDAP server over the network. The server must be reachable from the
        host running Gardik.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Create a read-only bind account">
          <Sub>
            Create a dedicated user in your directory with read-only access to the OU containing your
            employees. Do not use an admin account.
          </Sub>
          <Sub>
            Example bind DN: <Code>cn=gardik,ou=service-accounts,dc=company,dc=com</Code>
          </Sub>
          <Sub>
            For Active Directory: grant the account <em>Read</em> permission on the target OU only. Do not add
            it to any privileged group.
          </Sub>
        </Step>

        <Step n={2} title="Use LDAPS (port 636) if possible">
          <Sub>
            Plain LDAP (port 389) transmits credentials unencrypted. LDAPS encrypts the connection with TLS.
            Set SSL to <Code>true</Code> and port to <Code>636</Code>.
          </Sub>
          <Warning>
            If your LDAP server uses a self-signed certificate, the connection will fail by default. You must
            either install the CA certificate on the Gardik host or accept the risk of disabling certificate
            verification.
          </Warning>
        </Step>

        <Step n={3} title="Set the Base DN">
          <Sub>The base DN is the starting point for the user search. Set it as narrow as possible.</Sub>
          <Sub>
            Example: <Code>ou=employees,dc=company,dc=com</Code> rather than <Code>dc=company,dc=com</Code>.
          </Sub>
        </Step>

        <Step n={4} title="Set the user filter">
          <Sub>
            The filter controls which LDAP entries are treated as users. It must match entries that have a{" "}
            <Code>mail</Code> attribute.
          </Sub>
          <Sub>
            Active Directory:{" "}
            <Code>(&(objectClass=user)(mail=*)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))</Code>. This
            excludes disabled accounts.
          </Sub>
          <Sub>
            OpenLDAP: <Code>(&(objectClass=inetOrgPerson)(mail=*))</Code>
          </Sub>
        </Step>

        <Step n={5} title="Network access">
          <Sub>
            The LDAP server must allow incoming connections from the Gardik host on port 636 (or 389). If
            Gardik runs in a cloud environment, your on-premise LDAP server is likely not reachable without a
            VPN, a reverse proxy, or an explicit firewall rule.
          </Sub>
          <Sub>
            Verify with:{" "}
            <Code>{`ldapsearch -H ldaps://ldap.company.com:636 -D "cn=gardik,dc=company,dc=com" -W -b "dc=company,dc=com" "(mail=*)" mail`}</Code>
          </Sub>
        </Step>
      </div>
    </div>
  )
}
