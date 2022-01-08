##Dockerfile for building CosmoVis container

FROM dhna/mpi4py:latest

#set time zone
ENV TZ=US/Pacific
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

## Install required Ubuntu packages

RUN apt-get update && apt-get upgrade -y

RUN apt install -y build-essential
RUN apt install -y python3-dev
RUN apt install -y nginx
RUN apt install -y systemctl
RUN apt install -y htop
RUN apt install -y vim
RUN apt install -y wget
RUN apt install -y git-lfs
RUN apt-get -o Dpkg::Options::='--force-confmiss' install --reinstall -y netbase
RUN apt install -y curl
RUN apt install -y gnupg
RUN apt install -y apt-transport-https

COPY install_rabbitMQ.sh /
RUN chmod +x install_rabbitMQ.sh
RUN ./install_rabbitMQ.sh

##Create RabbitMQ user with permissions, which is used by Flask-SocketIO and Celery
##TODO: move the following commands to a startup script that runs when the container first starts?
# RUN systemctl start rabbitmq-server
# RUN rabbitmqctl add_user cosmovis sivomsoc
# RUN rabbitmqctl set_user_tags cosmovis administrator
# RUN rabbitmqctl set_permissions -p / cosmovis ".*" ".*" ".*"

##Install required Python packages
RUN python -m pip install --upgrade pip
COPY requirements.txt ./
RUN pip install -r requirements.txt

##Try to automate Trident install (needs work)
COPY hm2012_hr.h5.gz ./
RUN gzip -d hm2012_hr.h5.gz
RUN mkdir ~/.trident
COPY scripts/config.tri ~/.trident
RUN mv hm2012_hr.h5 ~/.trident

##Copy configuration scripts for NGINX and CosmoVis gunicorn service
COPY scripts/default /etc/nginx/sites-enabled/
COPY scripts/cosmovis.service /etc/systemd/system/

WORKDIR /cv-docker

RUN systemctl restart nginx
RUN systemctl daemon-reload
RUN systemctl enable cosmovis

EXPOSE 5000 4369 5671 5672 15691 15692 25672

# CMD [ "python", "./cosmo-serv.py" ]

COPY container_startup.sh /
CMD [ "bash", "./container_startup.sh" ]