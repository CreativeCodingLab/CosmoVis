# preprocess.py
import yt
import trident
import eagleSqlTools as sql
import numpy as np
import yt.units as units
from yt.visualization.volume_rendering.api import PointSource
from yt.units import kpc
import pylab
import json
import math
from math import log10, floor
import sys,os

def extractFeatures(simpath,sim_type,resolution_list,field_list,percent_stars):
    #simpath : local path to 1st hdf5 sim file
    #sim_type: 'EAGLE' or 'TNG' (add others as they come)

    enableParallelism()
    verifyTrident()
    print('LOADING DATA')
    ds = loadData(simpath)
    # dark_matter_density(ds,resolution_list[0])
    # ad = ds.all_data()
    # print(min(ad['PartType0','Temperature']))
    # print(max(ad['PartType0','Temperature']))
    print('EXTRACTING FIELD LIST')
    fl = getFieldList(ds)
    print('GENERATING VOXEL GRIDS')
    glist = generateVoxelGrid(ds,resolution_list,field_list,sim_type)
    print('EXPORTING STARS')
    exportStars(ds,percent_stars,sim_type)
    return glist


def enableParallelism():
    #Note: Requires MPI to be installed on machine
    yt.enable_parallelism()

def verifyTrident():
    trident.verify()

def loadData(filename):
    fn = filename
    print(fn)
    ds = yt.load(fn)
    return ds

def getFieldList(ds):
    fl = sorted(ds.field_list)
    print(sorted(fl))
    df = ds.derived_field_list
    # print(sorted(df))
    return fl





# def dark_matter_density(ds,size):
#     print(ds['Header'].attrs.get('HubbleParam'))
#     # return

def generateVoxelGrid(ds,resolution_list,field_list,sim_type):
    # simpath
    # resolution_list: list of resolutions to create, ex: [64,128,512] or [512]
    # field_list: list of particle fields to preprocess, ex: [['PartType0','Temperature'],['PartType0','Density'],['PartType1','Density']]
    fieldgridlist = []
    for j in range(len(resolution_list)):
        fieldgrids = []
        for i in range(len(field_list)):
            size = resolution_list[j]
            obj = createGrid(ds,size,field_list[i][1])
            grid = preprocessAttribute(obj,size,field_list[i][0],field_list[i][1],sim_type)
            fieldgrids.append(grid)
        fieldgridlist.append(fieldgrids)
    return fieldgridlist

def createGrid(ds,size,attr):
    print("create grid")
    if attr is 'PartType1_density':
        obj = ds.smoothed_covering_grid(2, left_edge=[0.0, 0.0, 0.0], dims=[size,size,size])
    else:
        obj = ds.arbitrary_grid(ds.domain_left_edge, ds.domain_right_edge,
                            dims=[size, size, size])
    return obj

def preprocessAttribute(obj,size,particle_type,attribute,sim_type):
    print(size)
    elements = ['PartType1_count', 'PartType1_density', 'PartType1_mass','Hydrogen','Helium','Carbon','Nickel','Oxygen','Neon','Magnesium','Silicon','Iron']
    try:
        print('EXTRACTING: ' + particle_type + ', ' + attribute)
        f = obj[particle_type, attribute]
        if str(f.units) == 'code_mass':
            attr = np.float32(np.array(f.in_units('Msun')))
            units = 'Msun'
        elif str(f.units) == 'K':
            attr = np.float32(np.array(f))
            units = 'K'
        elif str(f.units) == 'code_mass/code_length**3':
            attr = np.float32(np.array(f.in_cgs()))
            units = f.in_cgs().units
        elif str(f.units) == '(dimensionless)':
            attr = np.float32(np.array(f))
            units = 'dimensionless'
        else:
            attr = np.float32(np.array(f.in_cgs()))
            units = f.in_cgs().units
        if attribute is "Metallicity" or attribute is "GFM_Metallicity":
            attr = np.float32(np.array(f.in_units("Zsun")))
            units = 'Zsun'
        print(attribute,units)

        if attribute in elements:
            out = compressVoxelData(attr.tolist(),size,particle_type,attribute)

        else:
            out = transformVoxelData(attr)
            out = compressVoxelData(out,size,particle_type,attribute)



        with open( str( size ) + '_' + particle_type + '_' + attribute + '.json', 'w' ) as file:
            json.dump( out, file, separators=(',', ':') ) 

    
    except Exception as e:
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno)
    return attr   
    # def preprocessAttributes(ds,size,particle_type):
    #     for i in range(len(fl)):
    #         obj = createGrid(ds,size)
    #         if fl[i][0] == particle_type:
    #             attribute = fl[i][1]
    #             preprocessAttribute(obj,size,particle_type,attribute)

def transformVoxelData(voxelized_data):
    out = np.log10(voxelized_data.tolist())
    return out.tolist()

def compressVoxelData(voxelized_data,size,particle_type,attribute):
    
    # scale data to [a,b]=[1,255] range (UInt8)
    # reserve val=0 when voxel=-Infinity (artefact from taking log10(0))
    a = 1
    b = 255
    
    # find min and max value (after log10) that is not -Infinity or Infinity
    try:
        max_val = -np.inf
        min_val =  np.inf
        # print(voxelized_data[0].shape)

        # for c in range(3):
        # [[128],[128],[128]]
        maxv = np.max(voxelized_data)
        minv = np.nanmin(voxelized_data)
        
        # voxelized_data.flatten()
        

        if max_val < maxv:
            max_val = maxv
        if min_val > minv:
            min_val = minv
        print(max_val)
        print(min_val)
        print(maxv)
        print(minv)

        if particle_type is 'PartType0':
            if attribute is 'Temperature':
                min_val = 2.0
                max_val = 7.5
            if attribute is 'Carbon':
                min_val = 0.0001
                max_val = 0.001
            if attribute is 'Density':
                min_val = -33.0
                max_val = -27.0
            if attribute is 'Entropy':
                min_val = 1.0
                max_val = 6.0
            if attribute is 'Metallicity':
                min_val = -5.0
                max_val = 1.0
            if attribute is 'Oxygen':
                min_val = 0.0001
                max_val = 0.001
            if attribute is 'H_number_density':
                min_val = -8.5
                max_val = -3.0

        out = voxelized_data.copy()
        for i in range(size):
            for j in range(size):
                for k in range(size):

                    # if voxel > -Infinity
                    if (not math.isinf(voxelized_data[i][j][k])) and (int(voxelized_data[i][j][k]) is not 0):
                        # scale data between [a,b]
                        # multiply by 1000 to capture decimal precision into UInt8
                        # convert from float to int
                        out[i][j][k] = int( ( ( b - a ) * ( (voxelized_data[i][j][k] - min_val ) / ( max_val - min_val ) ) ) + a )
                        if float(out[i][j][k]) < 1.0:
                            out[i][j][k] = int(0)
                    else: # reserve val=0 when voxel=-Infinity (artefact from taking log10(0))
                        out[i][j][k] = int(0)
    except Exception as e:
        print('error: '+ str( e ))
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno) 
    return out




def exportStars(ds,percent,sim_type):
    # percent: % of number of particles to export between (0,100)
    ad=ds.all_data()
    index = np.random.randint(0,len(ad['PartType4', 'Coordinates']),size=int(len(ad['PartType4', 'Coordinates'])*(percent/100)))
    star_particles = {}
#     np.random.default_rng(4)
    for i in range(0,int(len(index)-1)):
        j = index[i]
        if sim_type is 'EAGLE':
            star_particles[i] = (
                                    round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
                                    round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
                                    round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
                                    float(ad['PartType4', 'GroupNumber'][j]), # group ID
                                    round(float(ad['PartType4', 'Mass'][j].in_units('Msun')),2) # stellar mass
                                )
        if sim_type is 'TNG':
            star_particles[i] = (
                                    round(float(ad['PartType4', 'Coordinates'][j][0].in_units('Mpc')),4), #x
                                    round(float(ad['PartType4', 'Coordinates'][j][1].in_units('Mpc')),4),   #y
                                    round(float(ad['PartType4', 'Coordinates'][j][2].in_units('Mpc')),4),   #z
                                    float(ad['PartType4', 'ParticleIDs'][j]), # group ID
                                    round(float(ad['PartType4', 'Masses'][j].in_units('Msun')),2) # stellar mass
                                )
    #         'particleID' : int(ad['PartType4', 'ParticleIDs'][i]),
            # 'x' : round(float(ad['PartType4', 'Coordinates'][j][0]),2),
            # 'y' : round(float(ad['PartType4', 'Coordinates'][j][1]),2),
            # 'z' : round(float(ad['PartType4', 'Coordinates'][j][2]),2),
            # 'g' : float(ad['PartType4', 'SubGroupNumber'][j]), # group ID
            # 'm' : round(float(np.log10(ad['PartType4', 'Mass'][j].in_units('Msun'))),2) # stellar mass
            # 's' : round(float((ad['PartType0', 'StarFormationRate'].ParticleIDs[ad['PartType4','ParticleIDs'][j]]).in_units('Myr')),2), # star formation rate
        # }
#             # more star attributes can be defined
#     #         'mass' : round(float(np.log10(ad['PartType4', 'Mass'][i].in_units('Msun'))),2)
    with open(str(percent)+'_star_particles.json', 'w') as file:
        json.dump(star_particles, file, separators=(',', ':') )
    print("exported stars")
    
def exportSimMetadata(ds,field_list):
    with open('simMetadata.json', 'w') as file:
        json.dump(field_list, file)

# def makeSimpleRay(ds,startPos,endPos):
#     ray = trident.make_simple_ray(ds, start_position=startPos,
#                                end_position=endPos,
#                                data_filename="ray.h5",
#                                fields=[('gas', 'density'), ('gas', 'temperature'), ('gas', 'metallicity')])
#     return ray

# def generateSkewer(ds,startPos,endPos):
#     ray = makeSimpleRay(ds,startPos,endPos)
#     line_list = ['H', 'C', 'N', 'O', 'Mg']
#     sg = trident.SpectrumGenerator('COS-G130M')
#     sg.make_spectrum(ray, lines=line_list)
#     sg.add_qso_spectrum(emitting_redshift=0.5)
#     sg.add_milky_way_foreground()
#     sg.apply_lsf() #instumental profile
#     sg.add_gaussian_noise(30)
#     sg.plot_spectrum('spec_qso_corrected.png')
#     sg.save_spectrum('spec_qso_corrected.txt')
