import eventlet
eventlet.monkey_patch()

# app.py
from threading import Lock
from flask import Flask, jsonify, request, render_template, session, copy_current_request_context
import yt
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


#Flask is used as web framework to run python scripts
#Flask-io / socketio :  gives Flask applications 
# access to low latency bi-directional communications
# between the clients and the server.

 
async_mode = 'eventlet'
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # clears cache on load for debugging
app.config['SECRET_KEY'] = 'secret!'
app.config['TEMPLATES_AUTO_RELOAD'] = True
socketio = SocketIO(app, async_mode=async_mode,async_handlers=True,upgradeTimeout=240000)#,logger=True, engineio_logger=True)
thread = None
thread_lock = Lock()

yt.enable_parallelism()
# fn = 'static/data/RefL0012N0188/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
# # fn = 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
# ds = yt.load(fn)
# fl = sorted(ds.field_list) # contains list of fields in the dataset
# ad = ds.all_data()
# right_edge = [float(ad.right_edge[0]),float(ad.right_edge[1]),float(ad.right_edge[2])]
# left_edge = [float(ad.left_edge[0]),float(ad.left_edge[1]),float(ad.left_edge[2])]
sgs = []
rpts = {}

# N = 1000000

spectrum_hdul = fits.HDUList()

def truncate(f, n):
    '''Truncates/pads a float f to n decimal places without rounding'''
    s = '{}'.format(f)
    if 'e' in s or 'E' in s:
        return '{0:.{1}f}'.format(f, n)
    i, p, d = s.partition('.')
    return '.'.join([i, (d+'0'*n)[:n]])


# createLookup()
# import pdb; pdb.set_trace()

# host the index.html web page
# default is localhost:5000
@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

# selectRay is called from index.html when 
@socketio.on('selectRay', namespace='/test')
def handle_ray_selection(simID,idx, start, end):
    socketio.start_background_task(handle_ray_selection_background,simID,idx, start, end)
    
def handle_ray_selection_background(simID,idx,start,end):
    # socketio = SocketIO(message_queue='amqp://')
    socketio.emit( 'processingRay', {'index': idx}, namespace = '/test' )
    # eventlet.sleep()
    socketio.sleep(0)

    fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
    # fn = 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
    ds = yt.load(fn)
    socketio.sleep(0)
    ad = ds.all_data()

    print('received args: ' + str(start) + str(end))

    ray_start = list(np.float_(start))
    ray_end = list(np.float_(end))
    print(ds.domain_left_edge)
    print(ds.domain_right_edge)
    line_list = ['H', 'C', 'N', 'O', 'Mg']

    instrument = 'COS'
    grating = 'G130M'
    inst = instrument + '-' + grating

    lambda_min = float(trident.valid_instruments[inst].lambda_min)
    lambda_max = float(trident.valid_instruments[inst].lambda_max)

    from trident.config import trident_path
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
        print(field)

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
                               data_filename="ray.h5",
                               lines=line_list)
    socketio.sleep(0)
    sg = trident.SpectrumGenerator(inst ,line_database="lines_subset_test.txt")
    # sg = trident.SpectrumGenerator('COS-G130M',line_database="lines.txt")
    
    # emit('my_response', {'data': 'Connected', 'count': -1})
    socketio.sleep(0)
    print('making spectrum')
    sg.make_spectrum(ray, lines=line_list)
    socketio.sleep(0)
    sg.add_qso_spectrum(emitting_redshift=0.5)
    

    MW = False
    if MW == True:
        sg.add_milky_way_foreground()
    socketio.sleep(0)
    sg.apply_lsf() #instrumental profile
    socketio.sleep(0)
    noise = True
    SNR = 30
    if noise == True:
        sg.add_gaussian_noise(SNR)
    socketio.sleep(0)
    error = sg.error_func(sg.flux_field)
    
    socketio.sleep(0)
    sgs.append([start,end,sg,idx])
    socketio.sleep(0)
    socketio.emit( 'sentRay', {'index': idx}, namespace = '/test' )
    print('emitting spectrum')
    socketio.sleep(0)
    socketio.sleep(0)
    socketio.sleep(0)
    socketio.emit('synthetic_spectrum',{'index':idx,'start':start,'end':end,'lambda':sgs[-1][2].lambda_field.tolist(),'flux':sgs[-1][2].flux_field.tolist()}, namespace='/test')
    socketio.sleep(0)


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
    
    # import pdb; pdb.set_trace()
    
    # socketio.emit( 'sentRay', {'index': idx}, namespace = '/test' )
    # eventlet.sleep()
    # socketio.emit('synthetic_spectrum',{'index':idx,'start':start,'end':end,'lambda':sgs[-1][2].lambda_field.tolist(),'flux':sgs[-1][2].flux_field.tolist()}, namespace='/test')
    # eventlet.sleep()
    print('sent spectrum')

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
            ds = yt.load(fn)
            fl = sorted(ds.field_list) # contains list of fields in the dataset
            ad = ds.all_data()
            right_edge = [float(ad.right_edge[0]),float(ad.right_edge[1]),float(ad.right_edge[2])]
            left_edge = [float(ad.left_edge[0]),float(ad.left_edge[1]),float(ad.left_edge[2])]
            emit('field_list', {'data': fl},namespace='/test')
            emit('domain_edges', {'left_edge': left_edge, 'right_edge': right_edge},namespace='/test')
    elif simID == 'RefL0025N0376':
        if fn != 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5':
            fn = 'static/data/RefL0025N0376/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
            ds = yt.load(fn)
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
    # global thread
    # with thread_lock:
    #     if thread is None:
    #         thread = socketio.start_background_task(background_thread)
    print("connected")
    emit('my_response', {'data': 'Connected', 'count': 0})
    # emit('field_list', {'data': fl})
    # emit('domain_edges', {'left_edge': left_edge, 'right_edge': right_edge})
    # if len(sgs):
    #     for i in range(sgs):
    #         emit('synthetic_spectrum',{'index':sgs[i][3],'start':sgs[i][0],'end':sgs[i][1],'lambda':sgs[i][2].lambda_field.tolist(),'flux':sgs[0][2].flux_field.tolist()}, namespace='/test')

if __name__ == '__main__':
    # socketio.run(app, debug=False)
    socketio.run(app, host='0.0.0.0', debug=False)


#@socketio.on('requestPositions', namespace='/test')
# def sendPositions():
#     socketio.start_background_task(sendPositions_background)

# def sendPositions_background():
#     #gas particles
#     # ids = np.array(ad['PartType0', 'ParticleIDs'])
#     # ids = list(ids)
#     # positions = np.array(ad['PartType0', 'Coordinates']).tolist()
#     # lookup = tuple(zip(ids, positions))
#     # n = len(lookup)
#     # for i in range(100):
#     #     eventlet.sleep()
#     #     socketio.emit('positionData', { 'particle_type':'PartType0','i':i+1,'data': lookup[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#     #     print(i+1,'/10 Data Sent')
    
#     ids = np.array(ad['PartType0', 'ParticleIDs'])
#     ids = list(ids)
#     positions = np.array(ad['PartType0', 'Coordinates'])
#     positions = np.around(positions,8)
#     positions = positions.tolist()
#     lookup = tuple(zip(ids, positions))
#     # n = len(lookup)
#     # for i in range(100):
#     #     eventlet.sleep()
#     #     socketio.emit('positionData', { 'particle_type':'PartType0','i':i+1,'data': lookup[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#     #     print(i+1,'/10 Data Sent')

#     with open('static/data/gasLookup-min.json', 'w') as file:
#         json.dump(lookup, file)
    

#     #dark matter particles
#     ids = np.array(ad['PartType1', 'ParticleIDs'])
#     ids = list(ids)
#     positions = np.array(ad['PartType1', 'Coordinates']).tolist()
#     positions = np.around(positions,8)
#     positions = positions.tolist()
#     lookup = tuple(zip(ids, positions))
#     # n = len(lookup)

#     # for i in range(100):
#     #     eventlet.sleep()
#     #     socketio.emit('positionData', { 'particle_type':'PartType1','i':i+1,'data': lookup[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#     #     print(i+1,'/10 Data Sent')

#     with open('static/data/dmLookup-min.json', 'w') as file:
#         json.dump(lookup, file)
    
#     #star particles
#     # ids = np.array(ad['PartType4', 'ParticleIDs'])
#     # ids = list(ids)
#     # positions = np.array(ad['PartType4', 'Coordinates']).tolist()
#     # lookup = tuple(zip(ids, positions))
#     # n = len(lookup)

#     # for i in range(10):
#     #     eventlet.sleep()
#     #     socketio.emit('positionData', { 'particle_type':'PartType4','i':i+1,'data': lookup[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#     #     print(i+1,'/10 Data Sent')

#     # with open('static/data/starLookup.json', 'w') as file:
#     #     json.dump(lookup, file)
    
#     #black hole particles
#     # ids = np.array(ad['PartType5', 'ParticleIDs'])
#     # ids = list(ids)
#     # positions = np.array(ad['PartType5', 'Coordinates']).tolist()
#     # lookup = tuple(zip(ids, positions))
#     # n = len(lookup)
    
#     # for i in range(10):
#     #     eventlet.sleep()
#     #     socketio.emit('positionData', { 'particle_type':'PartType5','i':i+1,'data': lookup[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#     #     print(i+1,'/10 Data Sent')
#     # with open('static/data/bhLookup.json', 'w') as file:
#     #     json.dump(lookup, file)




# @socketio.on('requestPoints', namespace='/test')
# def handle_attribute_selection(particle_type,attribute,renderCount):
#     socketio.start_background_task(handle_attribute_selection_background, particle_type,attribute,renderCount)

# def handle_attribute_selection_background(particle_type,attribute,renderCount):
#     #particle types: gas, dm, star, bh
#     # PartType0	gas
#     # PartType1	dark matter 'halo'
#     # PartType4	star
#     # PartType5	black hole
#     eventlet.sleep()
#     print('Received Request: ', particle_type, attribute )
#     print('Sending Data')
#     # particles = {}
#     # pmin = float(ad[particle_type, attribute].min())
#     # pmax = float(ad[particle_type, attribute].max())
#     # pmean = ad[particle_type, attribute].mean()
#     n = len(ad[particle_type, attribute])

#     # print(pmin,pmax,pmean)
#     print(len(ad[particle_type, attribute]))
#     # import pdb; pdb.set_trace() 
    

#     N = 1000000
#     # ids = list(np.array(ad[particle_type, 'ParticleIDs']))
#     units = ''
    
#     if str(ad[particle_type, attribute].units) == 'code_mass':
#         # attr = list(np.array(ad[particle_type, attribute].in_units('Msun')))
#         attr = np.array(ad[particle_type, attribute].in_units('Msun'))
#         attr = np.log10(attr)
#         pmin = np.around(float(attr.min()),3)
#         pmax = np.around(float(attr.max()),3)
#         attr = np.around(attr,3).tolist()
#         units = 'log(Msun)'
#     elif str(ad[particle_type, attribute].units) == 'K':
#         # attr = list(np.array(ad[particle_type, attribute]))
#         attr = np.array(ad[particle_type, attribute])
#         attr = np.log10(attr)
#         pmin = np.around(float(attr.min()),3)
#         pmax = np.around(float(attr.max()),3)
#         attr = np.around(attr,3).tolist()
#         units = 'log(K)'
#     elif attribute == 'Density':
#         # attr = list(np.array(ad[particle_type, attribute].in_cgs()))
#         attr = np.array(ad[particle_type, attribute].in_cgs())
#         attr = np.log10(attr)
#         pmin = np.around(float(attr.min()),3)
#         pmax = np.around(float(attr.max()),3)
#         attr = np.around(attr,3).tolist()
#         units = 'log(g/cm^3)'
#     elif str(ad[particle_type, attribute].units) == 'dimensionless':
#         # attr = list(np.array(ad[particle_type, attribute]))
#         attr = np.array(ad[particle_type, attribute])
#         attr = np.log10(attr)
#         pmin = np.around(float(attr.min()),3)
#         pmax = np.around(float(attr.max()),3)
#         attr = np.around(attr,3).tolist()
#         units = 'dimensionless'
#     else:
#         attr = np.array(ad[particle_type, attribute])
#         attr = np.log10(attr)
#         pmin = np.around(float(attr.min()),3)
#         pmax = np.around(float(attr.max()),3)
#         attr = np.around(attr,3).tolist()
#         units = str('log(',ad[particle_type, attribute].units,')')    

#     a = []
#     if particle_type == 'PartType0':
#         for i in range(renderCount*N):
#             a.append(attr[L_gas[i]])
#     elif particle_type == 'PartType5':
#         for i in range(renderCount*N):
#             a.append(attr[L_bh[i]])

#     # [:renderCount*N]
#     for i in range(renderCount):
#         socketio.emit('dataSentMsg',{'particle_type':particle_type,'value':i+1}, namespace='/test')
#         eventlet.sleep()
#         # socketio.emit('pointData',{'particle_type':particle_type,'i':i+1,'attribute':attribute, 'units':units,  'min':pmin, 'max':pmax, 'id': ids[int(i*n/10):int((i+1)*n/10)], 'attr': attr[int(i*n/10):int((i+1)*n/10)] }, namespace='/test')
#         socketio.emit('pointData',{'particle_type':particle_type,'i':i+1,'attribute':attribute, 'units':units,  'min':pmin, 'max':pmax, 'attr': a[int(i*N):int((i+1)*N)] }, namespace='/test')

#         print(i+1,'/',renderCount,'Data Sent')
    
#     # for i in range(0,len(ad[particle_type, attribute])-1): 
#     #     eventlet.sleep()
#     #     particles = {
#     #         # 'particleID' : int(ad['PartType1', 'ParticleIDs'][i]),
#     #         'x' : float(ad[particle_type, 'Coordinates'][i][0]),
#     #         'y' : float(ad[particle_type, 'Coordinates'][i][1]),
#     #         'z' : float(ad[particle_type, 'Coordinates'][i][2]),
#     #         attribute : (float(ad[particle_type, attribute][i])-pmin)/(pmax-pmin)
#     #     }
#     #     # print(float(ad[particle_type, attribute][i]))
#     #     # print(particles[attribute])
#     #     socketio.emit('pointData',{'particle_type':particle_type,'i':int(100*(i/len(ad[particle_type, attribute]))),'attribute':attribute,'data':particles })
#     #     # print(particles)

#     print('Data Sent')
#     # import pdb; pdb.set_trace()
    
#     # rpts.append({'particle_type':particle_type,'attribute':attribute,'data':particles })
#     # emit('pointData',{'particle_type':particle_type,'attribute':attribute,'data':particles })
#     # import pdb; pdb.set_trace()

    

