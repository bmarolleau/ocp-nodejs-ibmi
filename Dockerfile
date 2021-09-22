###ARG for odbc driver : can be ppc64le, x86_64, ppc64 
FROM  registry.access.redhat.com/ubi8/nodejs-14
ARG ARCHITECTURE=x86_64
ENV ARCHITECTURE $ARCHITECTURE
WORKDIR /opt/app-root/src
COPY . .
USER root
RUN rm -rf node_modules && yum --assumeyes install unixODBC-devel gcc
RUN unzip IBMiAccess_v1r1_LinuxAP_u14.zip \*${ARCHITECTURE}.rpm &&  yum --assumeyes  install  ./${ARCHITECTURE}/ibm-iaccess-*.rpm
RUN npm install -g npm node-pre-gyp && rm -rf node_modules package-lock.json
# test with sample odbc.ini - this file can be overwritten by a mounted file (secret or configmap)
RUN cp odbc.ini /etc/odbc.ini
RUN chown -R 1001:0 .
USER 1001
RUN npm install
CMD ["npm", "list"]
CMD ["node", "index.js"]
EXPOSE 8080
