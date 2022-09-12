import eventlet
eventlet.monkey_patch()

# app.py
import multiprocessing
import threading
from flask import Flask, jsonify, request, render_template, session, copy_current_request_context
from flask_compress import Compress
import yt
from yt import YTArray
import trident
import numpy as np
from astropy.io import fits
from astropy.table import Table
import json
import yt.units as units
from yt.visualization.volume_rendering.api import PointSource
from yt.units import kpc
import pylab
from itertools import product
from flask import Response, request
from flask_socketio import SocketIO, emit, join_room, leave_room, close_room, rooms, disconnect
import random
import mpi4py
from mpi4py import MPI
import os.path
from os import path
import os
import celery_tasks
import logging
from datetime import datetime

#Flask is used as web framework to run python scripts
#Flask-io / socketio :  gives Flask applications 
# access to low latency bi-directional communications
# between the clients and the server.
 
async_mode = 'eventlet'
app = Flask(__name__)

#Start SocketIO
async_mode = 'eventlet'
# amqp://cosmovis:sivomsoc@localhost:5672//
socketio = SocketIO(app, message_queue='amqp://cosmovis:sivomsoc@localhost:5672', cors_allowed_origins="*", async_mode=async_mode,async_handlers=True,upgradeTimeout=240000,logger=False, engineio_logger=False)
# socketio = SocketIO(app,message_queue='amqp://cosmovis:sivomsoc@localhost:5672',cors_allowed_origins="https://cosmovis-dev.nrp-nautilus.io", async_mode=async_mode,async_handlers=True,upgradeTimeout=240000,logger=False, engineio_logger=False)
@app.before_first_request
def before_first_request():
    #Flask-Compress extension automatically compresses static files
    Compress(app)
    #Configure Flask application
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # clears cache on load for debugging
    app.config['SECRET_KEY'] = 'secret!'
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    #Configure message queue backend
    app.config.update(
        broker_url='amqp://cosmovis:sivomsoc@localhost:5672',
        result_backend='rpc://',
        result_persistent=False,
        task_ignore_result = False,
        task_track_started = True,
        broker_heartbeat = 0
    )
    # app.logger.setLevel(logging.OFF)

@app.route('/webhook', methods=['POST'])
def webhook():
    if request.headers['Content-Type'] == 'application/json':
        info = json.dumps(request.json)
        # print(info)
#         threading.Thread(target=lambda: [time.sleep(2), os.system('systemctl restart cosmovis.service')]).start()
        os.system('/bin/bash update.sh')
        return info

js_logs = []
# @app.route('/js_logs', methods=['POST'])
@socketio.on('js_logs',namespace="/test")
def logs(incoming_log):
    # print("received log")
    # print(incoming_log)
    # js_logs.append(incoming_log)
    # # save logs to new json file
    # datetime.now()
    # with open('logs/js_logs_' + datetime.now().strftime("%d%b%Y_%Hh%Mm%Ss") +'.json', 'a+') as f:
    #     json.dump(incoming_log, f)
    # # import pdb; pdb.set_trace()
    # # print(json.loads(incoming_log['header']))
    # # print(json.loads(incoming_log['log']))
    return incoming_log

# route() decorator is used to define the URL where index() function is registered for
# host the index.html web page
# default is localhost:5000
@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

#getSkewerSimpleRay -- this function is used to get column density and physical data (temperature, entropy, metallicity) along the skewer and sends it back to the frontend
@socketio.on('getSkewerSimpleRay',namespace="/test")
def handle_ray_selection(simID,idx, start, end):

    # the actual code for computing the column densities can be found in 'celery_tasks.py', which is imported in this script
    # '.delay()' is used to have the task run by celery async in the background
    result = celery_tasks.handle_skewer_simple_ray.delay(simID,idx, start, end)
    # must '.get()' celery results to release it from the queue
    result.get()
    return jsonify({'id':result.id})

# selectRay is called from index.html when a user requests a spectrum
@socketio.on('selectRay', namespace='/test')
def handle_ray_selection(simID,idx, start, end):
    if path.exists('static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'):
        socketio.emit( 'synthetic_spectrum_saved', {'index': 'static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'}, namespace = '/test' )
    else:
        # print(simID,idx, start, end)
         # the actual code for computing the spectra can be found in 'celery_tasks.py', which is imported in this script
         # '.delay()' is used to have the task run by celery async in the background
        result = celery_tasks.make_synthetic_spectrum.delay(simID,idx, start, end)
        result.get()
        return jsonify({'id':result.id})

@socketio.on('makePlots',namespace="/test")
def handle_plot_request(simID,plot_type,galaxyID, center_coord_mpc, rvir, camera ):
    result = celery_tasks.make_plots.delay(simID,plot_type,galaxyID, center_coord_mpc, rvir, camera )
    result.get()
    return jsonify({'id':result.id})

@socketio.on('simIDtoServer', namespace='/test')
def updateSimID(simID):
             
    global fn
    global ds
    global fl 
    global ad
    global right_edge 
    global left_edge


    if simID == 'RefL0012N0188':
        if fn != 'static/data/RefL0012N0188/snapshot_028_z000p000/snap_028_z000p000.0.hdf5':
            fn = 'static/data/RefL0012N0188/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
            # ds = yt.load(fn)
            fl = sorted(ds.field_list) # contains list of fields in the dataset
            ad = ds.all_data()
            right_edge = [float(ad.right_edge[0]),float(ad.right_edge[1]),float(ad.right_edge[2])]
            left_edge = [float(ad.left_edge[0]),float(ad.left_edge[1]),float(ad.left_edge[2])]
            emit('field_list', {'data': fl},namespace='/test')
            emit('domain_edges', {'left_edge': left_edge, 'right_edge': right_edge},namespace='/test')
    elif simID == 'RefL0025N0376':
        if fn != 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5':
            fn = 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
            # ds = yt.load(fn)
            fl = sorted(ds.field_list) # contains list of fields in the dataset
            ad = ds.all_data()
            right_edge = [float(ad.right_edge[0]),float(ad.right_edge[1]),float(ad.right_edge[2])]
            left_edge = [float(ad.left_edge[0]),float(ad.left_edge[1]),float(ad.left_edge[2])]
            emit('field_list', {'data': fl},namespace='/test')
            emit('domain_edges', {'left_edge': left_edge, 'right_edge': right_edge},namespace='/test')
    with open('static/data/'+simID+'/simMetadata.json', 'w') as file:
        simMetadata = {
            "left_edge": left_edge,
            "right_edge": right_edge,
            "field_list": fl
        }
        json.dump(simMetadata, file)

@socketio.on('connect', namespace='/test')
def test_connect():
    # print("connected")
    emit('my_response', {'data': 'Connected', 'count': 0})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)