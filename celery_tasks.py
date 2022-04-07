#start this script with this command: celery worker -A celery_tasks.celery --loglevel=info -P eventlet

import eventlet
eventlet.monkey_patch(os=False)
import multiprocessing
from celery import Celery
from flask_socketio import SocketIO
# import mk_celery as mc
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
from flask import Response
from flask_socketio import SocketIO, emit, join_room, leave_room, close_room, rooms, disconnect
import random
import mpi4py
from mpi4py import MPI
import os.path
from os import path
from trident.config import trident_path
from scipy import interpolate
import sys,os
import copy
import pprint
import psutil
import time
from PIL import Image
async_mode = 'eventlet'

celery = Celery('cosmo-veg',broker='amqp://cosmovis:sivomsoc@localhost:5672', backend='rpc://', result_persistent=True,
    task_ignore_result = False,
    task_track_started = True,
    broker_heartbeat = 0)

socketio = SocketIO(message_queue='amqp://cosmovis:sivomsoc@localhost:5672', cors_allowed_origins="*", async_mode=async_mode,async_handlers=True,upgradeTimeout=240000,logger=True, engineio_logger=True)

multiprocessing.set_start_method('spawn')

yt.enable_parallelism()
sgs = []
rpts = {}

spectrum_hdul = fits.HDUList()

try:
    EAGLE_12Mpc = yt.load('static/data/RefL0012N0188/snapshot_028_z000p000/snap_028_z000p000.0.hdf5')
    EAGLE_12Mpc_ad = EAGLE_12Mpc.all_data()

except Exception as e:
    print('error: '+ str( e ))
    exc_type, exc_obj, exc_tb = sys.exc_info()
    fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
    print(exc_type, fname, exc_tb.tb_lineno) 

# try:
#     # EAGLE_25Mpc = yt.load('static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5')
#     EAGLE_25Mpc = yt.load('/cv-vol/EAGLE25_z0_0/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5')
#     EAGLE_25Mpc_ad = EAGLE_25Mpc.all_data()
# except Exception as e:
#     print('error: '+ str( e ))
#     exc_type, exc_obj, exc_tb = sys.exc_info()
#     fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
#     print(exc_type, fname, exc_tb.tb_lineno) 

# try:
#     EAGLE_100Mpc = yt.load('static/data/RefL0100N1504/snapshot/RefL0100N1504/snapshot_028_z000p000/snap_028_z000p000.0.hdf5')
#     # EAGLE_100Mpc = yt.load('/cv-vol/EAGLE100_z0_0/RefL0100N1504/snapshot_028_z000p000/snap_028_z000p000.0.hdf5')
#     EAGLE_100Mpc_ad = EAGLE_100Mpc.all_data()
# except Exception as e:
#     print('error: '+ str( e ))
#     exc_type, exc_obj, exc_tb = sys.exc_info()
#     fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
#     print(exc_type, fname, exc_tb.tb_lineno)

# try:
#     TNG100_snap030 = yt.load('static/data/TNG100_z2.3/snapshot/snap_030.0.hdf5')
#     # TNG100_snap030 = yt.load('/cv-vol/TNG100_z2_3/snap_030.0.hdf5')
#     TNG100_snap030_ad = TNG100_snap030.all_data()
# except Exception as e:
#     print('error: '+ str( e ))
#     exc_type, exc_obj, exc_tb = sys.exc_info()
#     fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
#     print(exc_type, fname, exc_tb.tb_lineno) 

# try:
#     TNG100_snap099 = yt.load('static/data/TNG100_z0.0/snapshot/snap_099.0.hdf5')
#     # TNG100_snap099 = yt.load('/cv-vol/TNG100_z0.0/snap_099.0.hdf5')
#     TNG100_snap099_ad = TNG100_snap099.all_data()
# except Exception as e:
#     print('error: '+ str( e ))
#     exc_type, exc_obj, exc_tb = sys.exc_info()
#     fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
#     print(exc_type, fname, exc_tb.tb_lineno) 

@celery.task()
def truncate(f, n):
    '''Truncates/pads a float f to n decimal places without rounding'''
    s = '{}'.format(f)
    if 'e' in s or 'E' in s:
        return '{0:.{1}f}'.format(f, n)
    i, p, d = s.partition('.')
    return '.'.join([i, (d+'0'*n)[:n]])

@celery.task()
def interpol8(oldx,oldy,newdx):
    
    # H_I = n.array([np.array(ray.r[('gas', 'l')].to('kpc').tolist()),np.array(ray.r[('gas', 'H_p0_number_density')] * ray.r[('gas', 'dl')].to('kpc').tolist())])
    oldx = np.array(oldx.tolist())
    oldy = np.array(oldy.tolist())
    # newdx = 1
    terpfunc = interpolate.interp1d(oldx, oldy,fill_value="extrapolate")
    newx = np.arange(np.min(oldx), np.max(oldx)+newdx, newdx)
    newy = terpfunc(newx)
    return newx.tolist(), newy.tolist()

@celery.task()
def handle_skewer_simple_ray(simID,idx,start,end):
    # socketio = SocketIO(message_queue='amqp://')
    # print('system cpu cores: ' + str(multiprocessing.cpu_count()))
    # sys.stdout.flush()
    # print('cpu cores available to python: ' + str(len(psutil.Process().cpu_affinity())))
    # sys.stdout.flush()
    # print('mpi parallelism: ' + str(yt.enable_parallelism()))
    sys.stdout.flush()
    print('received simple ray request')
    socketio.emit( 'retrievingLineData', {'index': idx}, namespace = '/test' )
    socketio.sleep(0)
    fn = ''
    # ds = []
    
    if simID == 'RefL0012N0188':
        ds = EAGLE_12Mpc
    elif simID == 'RefL0025N0376':
        ds = EAGLE_25Mpc
    elif simID == 'RefL0100N1504':
        ds = EAGLE_100Mpc
    elif simID == 'TNG100_z2.3':
        ds = TNG100_snap030
    elif simID == 'TNG100_z0.0':
        ds = TNG100_snap099
    else:
        # if 'RefL' in simID:
        #     fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
        # if 'TNG' in simID:
        #     fn = 'static/data/'+simID+'/snapshot/snap_030.0.hdf5'
        # print("loading" + str(fn))
        print(fn)
        ds = yt.load(fn)
    socketio.sleep(0)
    ad = ds.all_data()
    socketio.sleep(0)
    print(simID)

    socketio.sleep(0)

    sim_width = np.float(ds.domain_right_edge[0].in_units('Mpc') - ds.domain_left_edge[0].in_units('Mpc'))

    # print(ds.domain_right_edge)

    ray_start = np.float_(start)
    ray_end   = np.float_(end)
    # print('ray start: ' + str(ray_start))
    # print('ray end  : ' + str(ray_end))

    ray_start = ds.arr(ray_start/sim_width * np.float(ds.domain_right_edge[0]), 'code_length') #list(np.float_(start))
    ray_end   = ds.arr(ray_end/sim_width * np.float(ds.domain_right_edge[0]), 'code_length')   #list(np.float_(end))

    # ray_start = ds.arr(ray_start, 'Mpc')/sim_width #list(np.float_(start))
    # ray_end   = ds.arr(ray_end, 'Mpc')/sim_width  #list(np.float_(end))

    print(ray_start.in_units('Mpc'))
    print(ray_end.in_units('Mpc'))
    line_list = ['H', 'C', 'N', 'O', 'Mg']
    socketio.sleep(0)
    # This LightRay object is a yt dataset of a 1D data structure representing the skewer path as it traverses the dataset. 
    if simID[:3] == 'Ref':
        ray = trident.make_simple_ray(ds, start_position=ray_start,
                                end_position=ray_end,
                                data_filename="ray.h5",
                                lines=line_list,
                                ftype='gas',
                                fields=[('PartType0','Entropy')])
    elif simID[:3] == 'TNG':
        ray = trident.make_simple_ray(ds, start_position=ray_start,
                                end_position=ray_end,
                                data_filename="ray.h5",
                                lines=line_list)

    socketio.sleep(0)
    trident.add_ion_fields(ray, ions=['O VI', 'C IV', 'N', 'He I', 'He II', 'He III', 'O II', 'O III', 'O V', 'Ne III', 'Ne IV', 'Ne V', 'Ne VI', 'Ne VIII', 'Na I', 'Na IX', 'Mg X', 'Si II', 'Si III', 'Si IV', 'Si XII', 'S II', 'S III', 'S IV', 'S V', 'S VI', 'O IV'], ftype="PartType0")
    socketio.sleep(0)
    # for field in ray.derived_field_list: print(field)
    # ('gas', 'l') -- the 1D location of the gas going from nearby (0) to faraway along the LightRay
    # convert to kpc
    l = ray.r[('gas', 'l')].to('kpc')

    # print(ray)
    # ('gas', 'temperature') -- the gas temperature along l (K)

    # the way trident+yt represents ions as fields is a little weird
    # ex: For H I, which is neutral hydrogen, which is H (plus zero energy state), it's represented as H_p0
    # multiply number density by path length (dl) to get column density of ions (units cm^-2)
    socketio.sleep(0)
    dx = 4
    # n_density in units of particles/cm^3
    
    dl_cm = ray.r[('gas', 'dl')].to('cm')


    ## FULL RANGE VALUES
    ## used for graphing
    socketio.sleep(0)
    try:
        H_I = (ray.r[('gas', 'H_p0_number_density')].in_cgs() * dl_cm).tolist()
        i_H_I   = interpol8(l,ray.r[('gas', 'H_p0_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        H_I = []   
        i_H_I = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    
    socketio.sleep(0)
    try:
        H_II   = (ray.r[('gas', 'H_p1_number_density')].in_cgs()   * dl_cm).tolist()
        i_H_II  = interpol8(l,ray.r[('gas', 'H_p1_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        H_II  = []
        i_H_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_I    = (ray.r[('gas', 'C_p0_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_I   = interpol8(l,ray.r[('gas', 'C_p0_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        C_I    = []
        i_C_I  = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_II   = (ray.r[('gas', 'C_p1_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_II  = interpol8(l,ray.r[('gas', 'C_p1_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        C_II  = []
        i_C_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_III  = (ray.r[('gas', 'C_p2_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_III = interpol8(l,ray.r[('gas', 'C_p2_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        C_III  = []
        i_C_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_IV   = (ray.r[('gas', 'C_p3_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_IV  = interpol8(l,ray.r[('gas', 'C_p3_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        C_IV  = []
        i_C_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_V    = (ray.r[('gas', 'C_p4_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_V   = interpol8(l,ray.r[('gas', 'C_p4_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        C_V   = []
        i_C_V = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        C_VI   = (ray.r[('gas', 'C_p5_number_density')].in_cgs()   * dl_cm).tolist()
        i_C_VI  = interpol8(l,ray.r[('gas', 'C_p5_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        C_VI   = []
        i_C_VI = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        He_I   = (ray.r[('gas', 'He_p0_number_density')].in_cgs()  * dl_cm).tolist()
        i_He_I  = interpol8(l,ray.r[('gas', 'He_p0_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        He_I   = []
        i_He_I = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        He_II  = (ray.r[('gas', 'He_p1_number_density')].in_cgs()  * dl_cm).tolist()
        i_He_II = interpol8(l,ray.r[('gas', 'He_p1_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        He_II  = []
        i_He_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        He_III = (ray.r[('gas', 'He_p2_number_density')].in_cgs()  * dl_cm).tolist()
        i_He_III= interpol8(l,ray.r[('gas', 'He_p2_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        He_III = []
        i_He_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Mg_I   = (ray.r[('gas', 'Mg_p0_number_density')].in_cgs()  * dl_cm).tolist()
        i_Mg_I  = interpol8(l,ray.r[('gas', 'Mg_p0_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Mg_I  = []
        i_Mg_I= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Mg_II  = (ray.r[('gas', 'Mg_p1_number_density')].in_cgs()  * dl_cm).tolist()
        i_Mg_II = interpol8(l,ray.r[('gas', 'Mg_p1_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Mg_II  = []
        i_Mg_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Mg_X   = (ray.r[('gas', 'Mg_p9_number_density')].in_cgs()  * dl_cm).tolist()
        i_Mg_X  = interpol8(l,ray.r[('gas', 'Mg_p9_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Mg_X  = []
        i_Mg_X= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_II   = (ray.r[('gas', 'N_p1_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_II  = interpol8(l,ray.r[('gas', 'N_p1_number_density')].in_cgs() *  dl_cm,dx)[1]
        
    except Exception as e:
        N_II  = []
        i_N_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_III  = (ray.r[('gas', 'N_p2_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_III = interpol8(l,ray.r[('gas', 'N_p2_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        N_III  = []
        i_N_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_IV   = (ray.r[('gas', 'N_p3_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_IV  = interpol8(l,ray.r[('gas', 'N_p3_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        N_IV  = []
        i_N_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_V    = (ray.r[('gas', 'N_p4_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_V   = interpol8(l,ray.r[('gas', 'N_p4_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        N_V   = []
        i_N_V = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_VI   = (ray.r[('gas', 'N_p5_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_VI  = interpol8(l,ray.r[('gas', 'N_p5_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        N_VI   = []
        i_N_VI = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        N_VII  = (ray.r[('gas', 'N_p6_number_density')].in_cgs()   * dl_cm).tolist()
        i_N_VII = interpol8(l,ray.r[('gas', 'N_p6_number_density')].in_cgs() *  dl_cm,dx)[1]

    except Exception as e:
        N_VII  = []
        i_N_VII= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Na_I   = (ray.r[('gas', 'Na_p0_number_density')].in_cgs()  * dl_cm).tolist()
        i_Na_I  = interpol8(l,ray.r[('gas', 'Na_p0_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Na_I  = []
        i_Na_I= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Na_IX  = (ray.r[('gas', 'Na_p8_number_density')].in_cgs()  * dl_cm).tolist()
        i_Na_IX = interpol8(l,ray.r[('gas', 'Na_p8_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Na_IX  = []
        i_Na_IX= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Ne_III = (ray.r[('gas', 'Ne_p2_number_density')].in_cgs()  * dl_cm).tolist()
        i_Ne_III= interpol8(l,ray.r[('gas', 'Ne_p2_number_density')].in_cgs() * dl_cm,dx)[1]

    except Exception as e:
        Ne_III = []
        i_Ne_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Ne_IV  = (ray.r[('gas', 'Ne_p3_number_density')].in_cgs()  * dl_cm).tolist()
        i_Ne_IV = interpol8(l,ray.r[('gas', 'Ne_p3_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Ne_IV  = []
        i_Ne_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Ne_V   = (ray.r[('gas', 'Ne_p4_number_density')].in_cgs()  * dl_cm).tolist()
        i_Ne_V  = interpol8(l,ray.r[('gas', 'Ne_p4_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Ne_V  = []
        i_Ne_V= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Ne_VI  = (ray.r[('gas', 'Ne_p5_number_density')].in_cgs()  * dl_cm).tolist()
        i_Ne_VI = interpol8(l,ray.r[('gas', 'Ne_p5_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Ne_VI  = []
        i_Ne_VI= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Ne_VIII= (ray.r[('gas', 'Ne_p7_number_density')].in_cgs()  * dl_cm).tolist()
        i_Ne_VIII=interpol8(l,ray.r[('gas', 'Ne_p7_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Ne_VIII = []
        i_Ne_VIII= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_I    = (ray.r[('gas', 'O_p0_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_I   = interpol8(l,ray.r[('gas', 'O_p0_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_I   = []
        i_O_I = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_II   = (ray.r[('gas', 'O_p1_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_II  = interpol8(l,ray.r[('gas', 'O_p1_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_II  = []
        i_O_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_III  = (ray.r[('gas', 'O_p2_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_III = interpol8(l,ray.r[('gas', 'O_p2_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_III  = []
        i_O_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_IV   = (ray.r[('gas', 'O_p3_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_IV  = interpol8(l,ray.r[('gas', 'O_p3_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_IV  = []
        i_O_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_V    = (ray.r[('gas', 'O_p4_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_V   = interpol8(l,ray.r[('gas', 'O_p4_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_V  = []
        i_O_V= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_VI   = (ray.r[('gas', 'O_p5_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_VI  = interpol8(l,ray.r[('gas', 'O_p5_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_VI  = []
        i_O_VI= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_VII  = (ray.r[('gas', 'O_p6_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_VII = interpol8(l,ray.r[('gas', 'O_p6_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_VII  = []
        i_O_VII= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        O_VIII = (ray.r[('gas', 'O_p7_number_density')].in_cgs()   * dl_cm).tolist()
        i_O_VIII= interpol8(l,ray.r[('gas', 'O_p7_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        O_VIII = []
        i_O_VIII= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        S_II   = (ray.r[('gas', 'S_p1_number_density')].in_cgs()   * dl_cm).tolist()
        i_S_II  = interpol8(l,ray.r[('gas', 'S_p1_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        S_II  = []
        i_S_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        S_III  = (ray.r[('gas', 'S_p2_number_density')].in_cgs()   * dl_cm).tolist()
        i_S_III = interpol8(l,ray.r[('gas', 'S_p2_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        S_III  = []
        i_S_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        S_IV   = (ray.r[('gas', 'S_p3_number_density')].in_cgs()   * dl_cm).tolist()
        i_S_IV  = interpol8(l,ray.r[('gas', 'S_p3_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        S_IV  = []
        i_S_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        S_V    = (ray.r[('gas', 'S_p4_number_density')].in_cgs()   * dl_cm).tolist()
        i_S_V   = interpol8(l,ray.r[('gas', 'S_p4_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        S_V  = []
        i_S_V= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        S_VI   = (ray.r[('gas', 'S_p5_number_density')].in_cgs()   * dl_cm).tolist()
        i_S_VI  = interpol8(l,ray.r[('gas', 'S_p5_number_density')].in_cgs() *  dl_cm,dx)[1]
    except Exception as e:
        S_VI  = []
        i_S_VI= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Si_II  = (ray.r[('gas', 'Si_p1_number_density')].in_cgs()  * dl_cm).tolist()
        i_Si_II = interpol8(l,ray.r[('gas', 'Si_p1_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Si_II  = []
        i_Si_II= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Si_III = (ray.r[('gas', 'Si_p2_number_density')].in_cgs()  * dl_cm).tolist()
        i_Si_III= interpol8(l,ray.r[('gas', 'Si_p2_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Si_III = []
        i_Si_III= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Si_IV  = (ray.r[('gas', 'Si_p3_number_density')].in_cgs() * dl_cm).tolist()
        i_Si_IV = interpol8(l,ray.r[('gas', 'Si_p3_number_density')].in_cgs() * dl_cm,dx)[1]
    except Exception as e:
        Si_IV  = []
        i_Si_IV= []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    socketio.sleep(0)
    try:
        Si_XII = (ray.r[('gas', 'Si_p11_number_density')].in_cgs() * dl_cm).tolist()
        i_Si_XII= interpol8(l,ray.r[('gas', 'Si_p11_number_density')].in_cgs() *dl_cm,dx)[1]
    except Exception as e:
        Si_XII   = []
        i_Si_XII = []
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    
    finally:
        socketio.sleep(0)
        log_density = np.log10(ray.r[('gas', 'density')].in_cgs())+23.77+0.21 # dividing by mean molecular mass, mass of proton
        density     = (10**log_density).tolist() # divide by mean molecular mass... somewhere between ~(10^-6, 1)
        try:
            if simID[:3] == 'Ref':
                entropy   = (ray.r[('gas', 'Entropy')]).tolist()
                i_entropy = interpol8(l,ray.r[('gas', 'Entropy')],dx)[1]
            elif simID[:3] == 'TNG':
                entropy   = (ray.r[('gas', 'entropy')]).tolist()
                i_entropy = interpol8(l,ray.r[('gas', 'entropy')],dx)[1]
        except Exception as e:
            entropy = []
            i_entropy = []
            print('error: '+ str( e ))
            exc_type, exc_obj, exc_tb = sys.exc_info()
            fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
            print(exc_type, fname, exc_tb.tb_lineno) 

        socketio.sleep(0)
        metallicity = (ray.r[('gas', 'metallicity')].to('Zsun')).tolist()
        temperature = (ray.r[('gas', 'temperature')]).tolist()

        log_density = np.log10(ray.r[('gas', 'density')].in_cgs())+23.77+0.21 # dividing by mean molecular mass, mass of proton
        i_density       = (10**np.array(interpol8(l, log_density,dx)[1])).tolist() # divide by mean molecular mass... somewhere between ~(10^-6, 1)
        i_metallicity   = interpol8(l,ray.r[('gas', 'metallicity')].to('Zsun'),dx)[1]
        i_l, i_temperature = interpol8(l,ray.r[('gas', 'temperature')],dx)


        socketio.sleep(0)
        socketio.emit('simple_line_data',{  'index':         idx,
                                         'start':         start,
                                         'end':           end,
                                         'l':             l.tolist(),
                                         'N(H I)':        H_I,
                                         'N(H II)':       H_II,
                                         'N(C I)':        C_I,
                                         'N(C II)':       C_II,
                                         'N(C III)':      C_III,
                                         'N(C IV)':       C_IV,
                                         'N(C V)':        C_V,
                                         'N(C VI)':       C_VI,
                                         'N(He I)':       He_I,
                                         'N(He II)':      He_II,
                                         'N(He III)':     He_III,
                                         'N(Mg I)':       Mg_I,
                                         'N(Mg II)':      Mg_II,
                                         'N(Mg X)':       Mg_X,
                                         'N(N II)':       N_II,
                                         'N(N III)':      N_III,
                                         'N(N IV)':       N_IV,
                                         'N(N V)':        N_V,
                                         'N(N VI)':       N_VI,
                                         'N(N VII)':      N_VII,
                                         'N(Na I)':       Na_I,
                                         'N(Na IX)':      Na_IX,
                                         'N(Ne III)':     Ne_III,
                                         'N(Ne IV)':      Ne_IV,
                                         'N(Ne V)':       Ne_V,
                                         'N(Ne VI)':      Ne_VI,
                                         'N(Ne VIII)':    Ne_VIII,
                                         'N(O I)':        O_I,
                                         'N(O II)':       O_II,
                                         'N(O III)':      O_III,
                                         'N(O IV)':       O_IV,
                                         'N(O V)':        O_V,
                                         'N(O VI)':       O_VI,
                                         'N(O VII)':      O_VII,
                                         'N(O VIII)':     O_VIII,
                                         'N(S II)':       S_II,
                                         'N(S III)':      S_III,
                                         'N(S IV)':       S_IV,
                                         'N(S V)':        S_V,
                                         'N(S VI)':       S_VI,
                                         'N(Si II)':      Si_II,
                                         'N(Si III)':     Si_III,
                                         'N(Si IV)':      Si_IV,
                                         'N(Si XII)':     Si_XII,
                                         'density':       density,
                                         'entropy':       entropy,
                                         'metallicity':   metallicity,
                                         'temperature':   temperature,
                                         'i_l':           i_l,
                                         'i_N(H I)':      i_H_I,
                                         'i_N(H II)':     i_H_II,
                                         'i_N(C I)':      i_C_I,
                                         'i_N(C II)':     i_C_II,
                                         'i_N(C III)':    i_C_III,
                                         'i_N(C IV)':     i_C_IV,
                                         'i_N(C V)':      i_C_V,
                                         'i_N(C VI)':     i_C_VI,
                                         'i_N(He I)':     i_He_I,
                                         'i_N(He II)':    i_He_II,
                                         'i_N(He III)':   i_He_III,
                                         'i_N(Mg I)':     i_Mg_I,
                                         'i_N(Mg II)':    i_Mg_II,
                                         'i_N(Mg X)':     i_Mg_X,
                                         'i_N(N II)':     i_N_II,
                                         'i_N(N III)':    i_N_III,
                                         'i_N(N IV)':     i_N_IV,
                                         'i_N(N V)':      i_N_V,
                                         'i_N(N VI)':     i_N_VI,
                                         'i_N(N VII)':    i_N_VII,
                                         'i_N(Na I)':     i_Na_I,
                                         'i_N(Na IX)':    i_Na_IX,
                                         'i_N(Ne III)':   i_Ne_III,
                                         'i_N(Ne IV)':    i_Ne_IV,
                                         'i_N(Ne V)':     i_Ne_V,
                                         'i_N(Ne VI)':    i_Ne_VI,
                                         'i_N(Ne VIII)':  i_Ne_VIII,
                                         'i_N(O I)':      i_O_I,
                                         'i_N(O II)':     i_O_II,
                                         'i_N(O III)':    i_O_III,
                                         'i_N(O IV)':     i_O_IV,
                                         'i_N(O V)':      i_O_V,
                                         'i_N(O VI)':     i_O_VI,
                                         'i_N(O VII)':    i_O_VII,
                                         'i_N(O VIII)':   i_O_VIII,
                                         'i_N(S II)':     i_S_II,
                                         'i_N(S III)':    i_S_III,
                                         'i_N(S IV)':     i_S_IV,
                                         'i_N(S V)':      i_S_V,
                                         'i_N(S VI)':     i_S_VI,
                                         'i_N(Si II)':    i_Si_II,
                                         'i_N(Si III)':   i_Si_III,
                                         'i_N(Si IV)':    i_Si_IV,
                                         'i_N(Si XII)':   i_Si_XII,
                                         'i_density':     i_density,
                                         'i_entropy':     i_entropy,
                                         'i_metallicity': i_metallicity,
                                         'i_temperature': i_temperature
                                        }, namespace='/test')
    socketio.sleep(0)
    # print((ray.r[('gas', 'H_p0_number_density')])[0].units)

    print('sent simple ray data')

@celery.task()
def make_synthetic_spectrum(simID,idx,start,end):
    socketio.emit( 'processingRay', {'index': idx}, namespace = '/test' )
    eventlet.sleep()
    socketio.sleep(0)
    # fn = ''
    # if 'RefL' in simID:
    #     fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
    # if 'TNG' in simID:
    #     fn = 'static/data/'+simID+'/snapshot/snap_030.0.hdf5'
    # # ds = yt.load(fn)
    # socketio.sleep(0)
    # # ad = ds.all_data()

    fn = ''
    # ds = []
    
    if simID == 'RefL0012N0188':
        ds = EAGLE_12Mpc
    elif simID == 'RefL0025N0376':
        ds = EAGLE_25Mpc
    elif simID == 'RefL0100N1504':
        ds = EAGLE_100Mpc
    elif simID == 'TNG100_z2.3':
        ds = TNG100_snap030
    elif simID == 'TNG100_z0.0':
        ds = TNG100_snap099
    else:
        # if 'RefL' in simID:
        #     fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
        # if 'TNG' in simID:
        #     fn = 'static/data/'+simID+'/snapshot/snap_030.0.hdf5'
        # print("loading" + str(fn))
        print(fn)
        ds = yt.load(fn)
    ad = ds.all_data()
    print(simID)

    print('received args: ' + str(start) + str(end))
    ray_start = np.float_(start)
    ray_end = np.float_(end)

    sim_width = np.float(ds.domain_right_edge[0].in_units('Mpc') - ds.domain_left_edge[0].in_units('Mpc'))

    # ray_start = ds.arr(ray_start, 'Mpc') #list(np.float_(start))
    # ray_end   = ds.arr(ray_end, 'Mpc')
    ray_start = ds.arr(ray_start/sim_width * np.float(ds.domain_right_edge[0]), 'code_length') #list(np.float_(start))
    ray_end   = ds.arr(ray_end/sim_width * np.float(ds.domain_right_edge[0]), 'code_length')   #list(np.float_(end))

    print(ray_start.in_units('Mpc'))
    print(ray_end.in_units('Mpc'))
    line_list = ['H', 'C', 'N', 'O', 'Mg']

    instrument = 'COS'
    grating = 'G130M'
    inst = instrument + '-' + grating

    lambda_min = float(trident.valid_instruments[inst].lambda_min)
    lambda_max = float(trident.valid_instruments[inst].lambda_max)

    path = trident_path() + '/data/line_lists/lines.txt'
    path2 = trident_path() + '/data/line_lists/lines_subset_test.txt'
    
    lines_data = open(path,"r")
    open(path2, 'w').close()
    lines_subset_test = open(path2,"a")
    socketio.sleep(0)
    c = 0
    lines = {} # keeps track of lines and whether or not they are added to the subset
    for line in lines_data:
        if c == 0:
            lines_subset_test.write(line)
            c+=1
            continue
        field = line.split()
        # print(field)

        wavelength = float(field[2])
        element = field[0] + field[1] + truncate(wavelength,0)
        element = element[:-1]
        if (wavelength >= lambda_min) and (wavelength <= lambda_max):
            lines_subset_test.write(line)
            lines[element] = True
        else:
            lines[element] = False
            continue
        # import pdb; pdb.set_trace()
    
    lines_data.close()
    lines_subset_test.close()

    print("making simple ray")
    socketio.sleep(0)
    ray = trident.make_simple_ray(ds, start_position=ray_start,
                               end_position=ray_end,
                               data_filename="ray.h5", # update file name if we need multiple
                               lines=line_list)
    socketio.sleep(0)
    sg = trident.SpectrumGenerator(inst ,line_database="lines_subset_test.txt")#, dlambda=1)
    # sg = trident.SpectrumGenerator('COS-G130M',line_database="lines.txt")
    
    # emit('my_response', {'data': 'Connected', 'count': -1})
    socketio.sleep(0)
    print('making spectrum')
    sg.make_spectrum(ray, lines=line_list) #spitting information through std_out, scrape information
    socketio.sleep(0)
    # sg.add_qso_spectrum(emitting_redshift=0.5)
    

    MW = False
    if MW == True:
        sg.add_milky_way_foreground() #fine with COS G130M
    socketio.sleep(0)
    sg.apply_lsf() #instrumental profile
    socketio.sleep(0)
    noise = True
    SNR = 50
    if noise == True:
        sg.add_gaussian_noise(SNR)
    socketio.sleep(0)
    error = sg.error_func(sg.flux_field)
    
    socketio.sleep(0)
    sgs.append([start,end,sg,idx])
    socketio.sleep(0)
    socketio.emit( 'sentRay', {'index': idx}, namespace = '/test' )
    socketio.sleep(0)
    print('emitting spectrum')
    socketio.sleep(0)
    socketio.emit('synthetic_spectrum',{'index':idx,'start':start,'end':end,'lambda':sgs[-1][2].lambda_field.tolist(),'flux':sgs[-1][2].flux_field.tolist()}, namespace='/test')
    socketio.sleep(0)
    print('sent spectrum')

    # sg.save_spectrum('spec_raw.txt')
    # sg.plot_spectrum('spec_raw.png')
    # print(jsonify(sg.lambda_field.tolist()))
    # print(sg.flux_field.tolist())
    tab = Table((sgs[-1][2].lambda_field.tolist(), sgs[-1][2].flux_field.tolist(), error.tolist() ), names=["lambda","flux","error"])
    # tab = Table((sgs[-1][2].lambda_field.tolist(), sgs[-1][2].flux_field.tolist() ), names=["lambda","flux"])

    hdul = fits.table_to_hdu(tab)

    hdr = hdul.header
    # Software
    hdr['COSMOVIS'] = 0.1 # Cosmovis version
    hdr['TRIDENT'] =  trident.__version__   # Trident version
    hdr['YT'] = yt.__version__    # Yt version

    # Simulation
    hdr['SIM'] = 'EAGLE'    # Simulation (EAGLE, FIRE, etc.)
    hdr['SIM_VERS'] = 'RefL0012N0188'    # Sim version
    hdr['BOX_SIZE'] = ds.parameters['BoxSize']  # Box size
    hdr['Z'] = ds.parameters['Redshift']   # Redshift

    # Spectrum
    hdr['X1Y1Z1'] = str(start[0]) + ', ' + str(start[1]) + ', ' + str(start[2])           
                                    # X1, Y1, Z1
    hdr['X2Y2Z2'] = str(end[0]) + ', ' + str(end[1]) + ', '  + str(end[2])          
                                    # X2, Y2, Z2    
    hdr['MW_FRGND'] = MW            # MWforeground (True, False)
    hdr['NOISEADD'] = noise         # NoiseAdded (True, False)
    hdr['NOISETYP'] = 'Gaussian'    # NoiseType (Gaussian, custom)
    hdr['SNR'] = SNR                # SNR
    hdr['SEED'] = False             # NoiseSeed
    hdr['INSTRMNT'] = instrument    # Instrument
    hdr['GRATING'] = grating        # Grating
    hdr['ROTATION'] = 'null'        # Grating rotation
    hdr['RESOLUTN'] = float(sg.dlambda*6)    # Spectral resolution (Angstroms)

    # Lines added (each boolean)
    for line in lines:
        # print(lines[line])
        hdr[line] = lines[line]
        # HI1215
        # HI1025
        # HI972
        # OVI1031
        # OVI1037

    spectrum_hdul.append(hdul)
    spectrum_hdul.writeto('static/data/spectra.fits', overwrite=True)
    
    socketio.sleep(0)

    spec = {'index':idx,'start':start,'end':end,'lambda':sgs[-1][2].lambda_field.tolist(),'flux':sgs[-1][2].flux_field.tolist()}
    socketio.sleep()
    # with open('static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json', 'w') as file:
    #     json.dump(spec, file)
    # socketio.sleep(0)
    # socketio.emit( 'synthetic_spectrum_saved', {'index': 'static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'}, namespace = '/test' )
    # socketio.sleep(0)
    # print("spectrum saved")
    return {'index':idx,'start':start,'end':end,'lambda':sgs[-1][2].lambda_field.tolist(),'flux':sgs[-1][2].flux_field.tolist()}

@celery.task()
def make_plots(simID,plot_type,galaxyID, center_coord_mpc, rvir, camera ):

    ## This section still needs work
    ## Need to determine what types of plots would be useful -- any others?
    ## Give user some choices as to what plots to make
    ## Need to hook up a way to send plots back to front end
    ## Would it make more sense to call this function once to retrieve multiple plots simultaneously? Probably
    ## Would this operate on the singular galaxy level? Yes!

    ## Check simID ##
    if simID == 'RefL0012N0188':
        ds = EAGLE_12Mpc
    elif simID == 'RefL0025N0376':
        ds = EAGLE_25Mpc
    elif simID == 'RefL0100N1504':
        ds = EAGLE_100Mpc
    elif simID == 'TNG100_z2.3':
        ds = TNG100_snap030
    elif simID == 'TNG100_z0.0':
        ds = TNG100_snap099
    else:
        # if 'RefL' in simID:
        #     fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
        # if 'TNG' in simID:
        #     fn = 'static/data/'+simID+'/snapshot/snap_030.0.hdf5'
        # print("loading" + str(fn))
        print(fn)
        ds = yt.load(fn)
    ad = ds.all_data()
    print(simID)

    # import pdb; pdb.set_trace()

    ## Check plot type ## 

    # if plot_type == 'volume_rendering' or plot_type == 'all':
        #https://yt-project.org/doc/visualizing/volume_rendering.html#annotated-examples
    
    if plot_type == 'overplot_streamlines' or plot_type == 'all':
        #https://yt-project.org/doc/visualizing/callbacks.html#overplot-streamlines
        
        plot = yt.SlicePlot(ds, "z", ("gas", "density"), center=center_coord_mpc, width=(rvir, "Mpc"))
        plot.set_zlim(("gas", "density"), 1e-30, 1e-25)
        plot.annotate_streamlines(("gas", "velocity_x"), ("gas", "velocity_y"))
        plot.save()
        plot.save("static/slice.png")
        # import pdb; pdb.set_trace()

        with open('static/slice.png', 'rb') as f:
            image_data = f.read()
        socketio.sleep(0)

        socketio.emit('plot_made', {'image_data': image_data}, namespace='/test')

    
    # if plot_type == 'slice' or plot_type == 'all':
    #     #https://yt-project.org/doc/visualizing/plots.html#viewing-plots
    #     plot = yt.SlicePlot(ds, "z", ("gas", "pressure"), center="c")
    #     plot.save()
    #     plot.zoom(30)
    #     plot.save("zoom")
    #     socketio.emit('plot_made', {'image_data': plot})


    if plot_type == '2D_phase' or plot_type == 'all':

        #set tick bars https://yt-project.org/doc/cookbook/custom_colorbar_tickmarks.html


        # might be easier to start with
        # zlim scaling 
        #https://yt-project.org/doc/visualizing/plots.html#d-phase-plots
        print(center_coord_mpc)
        print(rvir)
        center = ds.arr(center_coord_mpc,"Mpc")# ds.arr([64.0, 64.0, 64.0], "code_length")
        rvir = ds.quan(rvir, "Mpc")
        sph = ds.sphere(center, rvir)
        units = {("gas", "density"): "g/cm**3", ("gas", "mass"): "Msun"}
        extrema = {("gas", "density"): (1e-30, 1e-25), ("gas", "temperature"): (1, 1e7)}

        profile = yt.create_profile(
            sph,
            [("gas", "density"), ("gas", "temperature")],
            n_bins=[128, 128],
            fields=[("gas", "mass")],
            weight_field=None,
            units=units,
            extrema=extrema,
        )

        plot = yt.PhasePlot.from_profile(profile)
        # plot.set_zlim(("gas", "density"), 1e-30, 1e-25)
        # plot.annotate_scale()
        plot.set_log(("gas", "density"), True)
        plot.set_log(("gas", "mass"), True)
        plot.set_log(("gas", "temperature"), True)
        plot.set_font_size(36)
        # plot.figure(facecolor='yellow')
        plot.set_background_color(field='all',color=[0.0,1.0,0.1,0.1])

        # for label in plot.xaxis.get_ticklabels():
        #     label.set_color("red")
        #     label.set_fontsize(16)
        # import pdb; pdb.set_trace()

        file_url = 'static/'+ simID + '_' + str(galaxyID) + 'phase.png'

        plot.save(file_url)

        convertWhiteToTransparent(file_url)
        # with open(file_url, 'w+') as f:
        #     image_data = f.read()
        socketio.emit('plot_made', {'image_url': file_url}, namespace='/test')



    # base64 encode (https://newbedev.com/how-to-stream-live-video-frames-from-client-to-flask-server-and-back-to-the-client)

    # stringData = base64.b64encode(plot).decode('utf-8')
    # b64_src = 'data:image/jpg;base64,'
    # plot_image = b64_src + stringData

    # emit the frame back

    # return plot

@celery.task()
def convertWhiteToTransparent(image_path):    
    img = Image.open(image_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        if item[0] == 255 and item[1] == 255 and item[2] == 255:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(image_path, "PNG")