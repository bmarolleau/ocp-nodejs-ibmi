# IBM i Dash
Welcome!  This is an open source project that aims to make it easy to create dashboard pages for IBM i purposes.

##Please [fork](http://www.ibmsystemsmag.com/ibmi/developer/general/How-to-Contribute-to-Open-Source-Projects/) and add your own dashboard page!

![ibmidash_logo.png](https://bitbucket.org/repo/LjEMEz/images/345524619-ibmidash_logo.png)

![2015-06-01_18-38-07.png](https://bitbucket.org/repo/LjEMEz/images/613510403-2015-06-01_18-38-07.png)

![2015-06-01_18-50-24.png](https://bitbucket.org/repo/LjEMEz/images/65460062-2015-06-01_18-50-24.png)

## Secure Server Config
Program `openssl` was obtained from [perzl.org](http://perzl.org)

```
$ openssl genrsa -out ibmidash-key.pem 2048
$ openssl req -new -sha256 -key ibmidash-key.pem -out ibmidash-csr.pem
$ openssl x509 -req -in ibmidash-csr.pem -signkey ibmidash-key.pem -out ibmidash-cert.pem
```

#Who Was Here
The following people have taken the time to learn how to do a Git fork and pull request on IBM i.  Well done!

##People
- Aaron Bartell, Krengel Technology, Inc.
- Christian Jorgensen
- Brian Garland
- Travis Glover twitter/@iistrav
