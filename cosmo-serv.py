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
import mpi4py
import os.path
from os import path
from trident.config import trident_path
from scipy import interpolate

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
sgs = []
rpts = {}

spectrum_hdul = fits.HDUList()

# simID = 'RefL0012N0188'
# fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
# ds = yt.load(fn)

def truncate(f, n):
    '''Truncates/pads a float f to n decimal places without rounding'''
    s = '{}'.format(f)
    if 'e' in s or 'E' in s:
        return '{0:.{1}f}'.format(f, n)
    i, p, d = s.partition('.')
    return '.'.join([i, (d+'0'*n)[:n]])

def interpol8(oldx,oldy,newdx):
    
    # H_I = n.array([np.array(ray.r[('gas', 'l')].to('kpc').tolist()),np.array(ray.r[('gas', 'H_p0_number_density')] * ray.r[('gas', 'dl')].to('kpc').tolist())])
    oldx = np.array(oldx.tolist())
    oldy = np.array(oldy.tolist())
    # newdx = 1
    terpfunc = interpolate.interp1d(oldx, oldy,fill_value="extrapolate")
    newx = np.arange(np.min(oldx), np.max(oldx)+newdx, newdx)
    newy = terpfunc(newx)
    return newx.tolist(), newy.tolist()

# createLookup()
# import pdb; pdb.set_trace()

# host the index.html web page
# default is localhost:5000
@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

#getSkewerSimpleRay -- this function is used to get the 'quick' data along the skewer and sends it back to the frontend
@socketio.on('getSkewerSimpleRay',namespace="/test")
def handle_skewer_simple_ray(simID,idx,start,end):
    print('recieved simple ray request')
    socketio.emit( 'retrievingLineData', {'index': idx}, namespace = '/test' )
    socketio.sleep(0)

    fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
    ds = yt.load(fn)
    socketio.sleep(0)


    ray_start = list(np.float_(start))
    ray_end = list(np.float_(end))
    print(ds.domain_left_edge)
    print(ds.domain_right_edge)
    line_list = ['H', 'C', 'N', 'O', 'Mg']
    socketio.sleep(0)
    # This LightRay object is a yt dataset of a 1D data structure representing the skewer path as it traverses the dataset. 
    ray = trident.make_simple_ray(ds, start_position=ray_start,
                               end_position=ray_end,
                               data_filename="ray.h5", # update file name if we need multiple
                               lines=line_list)
    socketio.sleep(0)
    trident.add_ion_fields(ray, ions=['O VI', 'C IV', 'N', 'He I', 'He II', 'O II', 'O III', 'O V', 'Ne III', 'Ne IV', 'Ne V', 'Ne VI', 'Ne VIII', 'Na I', 'Na IX', 'Mg X', 'Si II', 'Si III', 'Si IV', 'Si XII', 'S II', 'S III', 'S IV', 'S V', 'S VI', 'O IV'])


    # ('gas', 'l') -- the 1D location of the gas going from nearby (0) to faraway along the LightRay
    # convert to kpc
    l = ray.r[('gas', 'l')].to('kpc')


    # ('gas', 'temperature') -- the gas temperature along l (K)

    # the way trident+yt represents ions as fields is a little weird
    # ex: For H I, which is neutral hydrogen, which is H (plus zero energy state), it's represented as H_p0
    # multiply number density by path length (dl) to get column density of ions (units cm^-2)
    socketio.sleep(0)
    dx = 1
    # n_density in units of particles/cm^3
    
    dl_cm = ray.r[('gas', 'dl')].to('cm')


    H_I   = interpol8(l,ray.r[('gas', 'H_p0_number_density')]*dl_cm,dx)[1]
    H_II  = interpol8(l,ray.r[('gas', 'H_p1_number_density')] * dl_cm,dx)[1]
    
    C_I   = interpol8(l,ray.r[('gas', 'C_p0_number_density')] * dl_cm,dx)[1]
    C_II  = interpol8(l,ray.r[('gas', 'C_p1_number_density')] * dl_cm,dx)[1]
    C_III = interpol8(l,ray.r[('gas', 'C_p2_number_density')] * dl_cm,dx)[1]
    C_IV  = interpol8(l,ray.r[('gas', 'C_p3_number_density')] * dl_cm,dx)[1]
    C_V   = interpol8(l,ray.r[('gas', 'C_p4_number_density')] * dl_cm,dx)[1]
    C_VI  = interpol8(l,ray.r[('gas', 'C_p5_number_density')] * dl_cm,dx)[1]
    
    He_I  = interpol8(l,ray.r[('gas', 'He_p0_number_density')] * dl_cm,dx)[1]
    He_II = interpol8(l,ray.r[('gas', 'He_p1_number_density')] * dl_cm,dx)[1]
    He_III= interpol8(l,ray.r[('gas', 'He_p2_number_density')] * dl_cm,dx)[1]
    
    Mg_I  = interpol8(l,ray.r[('gas', 'Mg_p0_number_density')] * dl_cm,dx)[1]
    Mg_II = interpol8(l,ray.r[('gas', 'Mg_p1_number_density')] * dl_cm,dx)[1]
    Mg_X  = interpol8(l,ray.r[('gas', 'Mg_p9_number_density')] * dl_cm,dx)[1]

    N_II  = interpol8(l,ray.r[('gas', 'N_p1_number_density')] * dl_cm,dx)[1]
    N_III = interpol8(l,ray.r[('gas', 'N_p2_number_density')] * dl_cm,dx)[1]
    N_IV  = interpol8(l,ray.r[('gas', 'N_p3_number_density')] * dl_cm,dx)[1]
    N_V   = interpol8(l,ray.r[('gas', 'N_p4_number_density')] * dl_cm,dx)[1]
    N_VI  = interpol8(l,ray.r[('gas', 'N_p5_number_density')] * dl_cm,dx)[1]
    N_VII = interpol8(l,ray.r[('gas', 'N_p6_number_density')] * dl_cm,dx)[1]
    
    Na_I  = interpol8(l,ray.r[('gas', 'Na_p0_number_density')] * dl_cm,dx)[1]
    Na_IX = interpol8(l,ray.r[('gas', 'Na_p8_number_density')] * dl_cm,dx)[1]

    Ne_III= interpol8(l,ray.r[('gas', 'Ne_p2_number_density')] * dl_cm,dx)[1]
    Ne_IV = interpol8(l,ray.r[('gas', 'Ne_p3_number_density')] * dl_cm,dx)[1]
    Ne_V  = interpol8(l,ray.r[('gas', 'Ne_p4_number_density')] * dl_cm,dx)[1]
    Ne_VI = interpol8(l,ray.r[('gas', 'Ne_p5_number_density')] * dl_cm,dx)[1]
    Ne_VIII= interpol8(l,ray.r[('gas', 'Ne_p7_number_density')] * dl_cm,dx)[1]

    O_I   = interpol8(l,ray.r[('gas', 'O_p0_number_density')] * dl_cm,dx)[1]
    O_II  = interpol8(l,ray.r[('gas', 'O_p1_number_density')] * dl_cm,dx)[1]
    O_III = interpol8(l,ray.r[('gas', 'O_p2_number_density')] * dl_cm,dx)[1]
    O_IV  = interpol8(l,ray.r[('gas', 'O_p3_number_density')] * dl_cm,dx)[1]
    O_V   = interpol8(l,ray.r[('gas', 'O_p4_number_density')] * dl_cm,dx)[1]
    O_VI  = interpol8(l,ray.r[('gas', 'O_p5_number_density')] * dl_cm,dx)[1]
    O_VII = interpol8(l,ray.r[('gas', 'O_p6_number_density')] * dl_cm,dx)[1]
    O_VIII= interpol8(l,ray.r[('gas', 'O_p7_number_density')] * dl_cm,dx)[1]

    S_II  = interpol8(l,ray.r[('gas', 'S_p1_number_density')] * dl_cm,dx)[1]
    S_III = interpol8(l,ray.r[('gas', 'S_p2_number_density')] * dl_cm,dx)[1]
    S_IV  = interpol8(l,ray.r[('gas', 'S_p3_number_density')] * dl_cm,dx)[1]
    S_V   = interpol8(l,ray.r[('gas', 'S_p4_number_density')] * dl_cm,dx)[1]
    S_VI  = interpol8(l,ray.r[('gas', 'S_p5_number_density')] * dl_cm,dx)[1]

    Si_II  = interpol8(l,ray.r[('gas', 'Si_p1_number_density')] * dl_cm,dx)[1]
    Si_III = interpol8(l,ray.r[('gas', 'Si_p2_number_density')] * dl_cm,dx)[1]
    Si_IV  = interpol8(l,ray.r[('gas', 'Si_p3_number_density')] * dl_cm,dx)[1]
    Si_XII = interpol8(l,ray.r[('gas', 'Si_p11_number_density')] * dl_cm,dx)[1]

    # El    = interpol8(l,ray.r[('gas', 'El_number_density')] * ray.r[('gas', 'dl')].to('kpc'),dx)[1]

    print(ray.r[('gas', 'density')])
    log_density = np.log10(ray.r[('gas', 'density')])+23.77+0.21 # dividing by mean molecular mass, mass of proton
    print(log_density)
    density       = (10**np.array(interpol8(l, log_density,dx)[1])).tolist() # divide by mean molecular mass... somewhere between ~(10^-6, 1)
    entropy       = interpol8(l,ray.r[('gas', 'entropy')],dx)[1]
    metallicity   = interpol8(l,ray.r[('gas', 'metallicity')].to('Zsun'),dx)[1]
    # metal_mass    = ray.r[('gas', 'metal_mass')] * ray.r[('gas', 'dl')]
    # mass          = ray.r[('gas', 'mass')] * ray.r[('gas', 'dl')]
    l, T = interpol8(l,ray.r[('gas', 'temperature')],dx)
    # optical_depth = interpol8(l,ray.r[('gas', 'optical_depth')] * ray.r[('gas', 'dl')].to('kpc'),dx)

    # total gas density, entropy, metal mass, mass, optical depth
    # import pdb; pdb.set_trace()

    socketio.sleep(0)
    socketio.emit('simple_line_data',{'index':   idx,
                                        'start': start,
                                        'end':   end,
                                        'l':     l,
                                        'N(H I)':   H_I,
                                        'N(H II)':  H_II,
                                        'N(C I)':   C_I,
                                        'N(C II)':  C_II,
                                        'N(C III)': C_III,
                                        'N(C IV)':  C_IV,
                                        'N(C V)':   C_V,
                                        'N(C VI)':  C_VI,
                                        'N(He I)':  He_I,
                                        'N(He II)': He_II,
                                        'N(He III)':He_III,
                                        'N(Mg I)':  Mg_I,
                                        'N(Mg II)': Mg_II,
                                        'N(Mg X)':  Mg_X,
                                        'N(N II)':  N_II,
                                        'N(N III)': N_III,
                                        'N(N IV)':  N_IV,
                                        'N(N V)':   N_V,
                                        'N(N VI)':  N_VI,
                                        'N(N VII)': N_VII,
                                        'N(Na I)':  Na_I,
                                        'N(Na IX)': Na_IX,
                                        'N(Ne III)':Ne_III,
                                        'N(Ne IV)': Ne_IV,
                                        'N(Ne V)':  Ne_V,
                                        'N(Ne VI)': Ne_VI,
                                        'N(Ne VIII)':Ne_VIII,
                                        'N(O I)':   O_I,
                                        'N(O II)':  O_II,
                                        'N(O III)': O_III,
                                        'N(O IV)':  O_IV,
                                        'N(O V)':   O_V,
                                        'N(O VI)':  O_VI,
                                        'N(O VII)': O_VII,
                                        'N(O VIII)':O_VIII,
                                        'N(S II)':  S_II,
                                        'N(S III)': S_III,
                                        'N(S IV)':  S_IV,
                                        'N(S V)':   S_V,
                                        'N(S VI)':  S_VI,
                                        'N(Si II)': Si_II,
                                        'N(Si III)':Si_III,
                                        'N(Si IV)': Si_IV,
                                        'N(Si XII)':Si_XII,
                                        # 'El':    El,
                                        'density': density,
                                        'entropy': entropy,
                                        'metallicity': metallicity,
                                        # 'metal_mass': metal_mass.tolist(),
                                        # 'mass': mass.tolist(),
                                        # 'optical_depth': optical_depth,
                                        'temperature': T
                                        }, namespace='/test')
    socketio.sleep(0)

    print('sent simple ray data')

# selectRay is called from index.html when 
@socketio.on('selectRay', namespace='/test')
def handle_ray_selection(simID,idx, start, end):
    try:
        if path.exists('static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'):
            socketio.emit( 'synthetic_spectrum_saved', {'index': 'static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'}, namespace = '/test' )
        else:
            socketio.start_background_task(handle_ray_selection_background,simID,idx, start, end)
    except:
        socketio.emit( 'spectrumError', {'index': idx}, namespace = '/test' )

    
def handle_ray_selection_background(simID,idx,start,end):
    # socketio = SocketIO(message_queue='amqp://')
    socketio.emit( 'processingRay', {'index': idx}, namespace = '/test' )
    eventlet.sleep()
    socketio.sleep(0)

    fn = 'static/data/'+simID+'/snapshot_028_z000p000/snap_028_z000p000.0.hdf5'
    ds = yt.load(fn)
    socketio.sleep(0)
    # ad = ds.all_data()

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
    sg.add_qso_spectrum(emitting_redshift=0.5)
    

    MW = False
    if MW == True:
        sg.add_milky_way_foreground() #fine with COS G130M
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
    socketio.sleep(0)
    print('emitting spectrum')
    socketio.sleep(0)
    socketio.sleep(0)
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
    with open('static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json', 'w') as file:
        json.dump(spec, file)
    socketio.sleep(0)
    socketio.emit( 'synthetic_spectrum_saved', {'index': 'static/data/skewers/'+simID+'_'+str(idx)+'_'+str(start)+'_'+str(end)+'.json'}, namespace = '/test' )
    socketio.sleep(0)
    print("spectrum saved")
    

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
    print("connected")
    emit('my_response', {'data': 'Connected', 'count': 0})


if __name__ == '__main__':
    # socketio.run(app, debug=False)
    socketio.run(app, host='0.0.0.0', debug=True)
    # socketio.run(app, host='0.0.0.0', port=80, threaded=False, debug=False)