###ARG CAN BE ppc64le, x86_64, ppc64 
FROM  registry.access.redhat.com/ubi8/nodejs-14
ARG ARCHITECTURE=ppc64le
ENV ARCHITECTURE $ARCHITECTURE
WORKDIR /app
COPY . .
RUN id
USER 0
RUN rm -rf node_modules
RUN yum repolist
RUN yum --assumeyes install unixODBC-devel gcc
RUN yum --assumeyes install python3 && ln -sf python3 /usr/bin/python
#RUN curl -vvv -k 'https://w3.rchland.ibm.com/projects/CA400/Win32/process/express/drivers/pool/v7r2m0/v0001/IBMiAccess_v1r1_LinuxAP_u14.zip' -o ap.zip
#RUN unzip -j ap.zip \*x86_64.rpm
RUN unzip IBMiAccess_v1r1_LinuxAP_u14.zip \*${ARCHITECTURE}.rpm
RUN  yum --assumeyes  install  ./${ARCHITECTURE}/ibm-iaccess-*.rpm
RUN npm install -g npm
RUN npm install -g node-pre-gyp
RUN rm -rf node_modules package-lock.json
# test with sample odbc.ini - this file will be mounted from a secret or configmap
RUN cp /app/odbc.ini /etc/odbc.ini
RUN chown -R 1001:0 /app
USER 1001
RUN npm install
RUN npm list
RUN ls node_modules/odbc
CMD ["npm", "list"]
CMD ["node", "index.js"]
EXPOSE 8080
