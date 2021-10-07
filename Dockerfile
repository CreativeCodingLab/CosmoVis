FROM dhna/mpi4py:latest

ENV TZ=US/Pacific
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update -y && \
    apt-get upgrade -y

RUN apt install -y build-essential
RUN apt install -y python3-dev
RUN apt install -y nginx
RUN apt install -y systemctl
RUN apt install -y htop
RUN apt install -y vim
RUN apt install -y wget
RUN apt-get -o Dpkg::Options::='--force-confmiss' install --reinstall -y netbase
RUN python -m pip install --upgrade pip
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY hm2012_hr.h5.gz ./
RUN gzip hm2012_hr.h5.gz

RUN mkdir ~/.trident
COPY scripts/config.tri ~/.trident
RUN mv hm2012_hr ~/.trident

COPY scripts/default /etc/nginx/sites-enabled/
COPY scripts/cosmovis.service /etc/systemd/system/

RUN git clone https://github.com/CreativeCodingLab/CosmoVis.git
WORKDIR /cv-docker

RUN systemctl restart nginx
RUN systemctl daemon-reload
RUN systemctl enable cosmovis
RUN systemctl start cosmovis.service

EXPOSE 5000

CMD [ "python", "./cosmo-serv.py" ]