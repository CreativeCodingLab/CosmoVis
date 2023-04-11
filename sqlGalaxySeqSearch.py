import eagleSqlTools as sql 
import numpy as np
import json


def return_sql_query(sims,connect):
    "mySims should be an array with each entry like (simName,simSize)"

    for name,size in mySims:
        print(name,size)

        # Construct and execute query:
        # myQuery = "SELECT \
        #     SH.GalaxyID as galID, \
        #     SH.GroupID as haloID, \
        #     SH.GroupNumber as groupNum, \
        #     SH.SubGroupNumber as subgroupNum,  \
        #     SH.LastProgID as lastProgID, \
        #     SH.DescendantID as descendantID, \
        #     SH.TopLeafID as topLeafID, \
        #     FOF.Group_M_Crit200 as mh,   \
        #     FOF.Group_R_Crit200 as rh,  \
        #     FOF.NumOfSubhalos as num_sh,  \
        #     SH.MassType_Star as ms,  \
        #     SH.MassType_Gas as mg,  \
        #     SH.StarFormationRate as sfr,  \
        #     SH.CentreOfPotential_x as gal_x,  \
        #     SH.CentreOfPotential_y as gal_y,  \
        #     SH.CentreOfPotential_z as gal_z,  \
        #     FOF.GroupCentreOfPotential_x as halo_x,  \
        #     FOF.GroupCentreOfPotential_y as halo_y,  \
        #     FOF.GroupCentreOfPotential_z as halo_z  \
        # FROM \
        #     %s_SubHalo as SH, \
        #     %s_FOF as FOF  \
        # WHERE  \
        #     SH.Snapnum = %s and   \
        #     SH.MassType_Star > 1.0e8 and  \
        #     Spurious = 0 and  \
        #     FOF.GroupID = SH.GroupID and   \
        #     FOF.SnapNum = SH.Snapnum"%(name, name, snapNum)

        myQuery = "SELECT \
                DES.GalaxyID as desGalaxyID, \
                DES.GroupID as desHaloID, \
                PROG.GalaxyID as progGalaxyID, \
                PROG.GroupID as progHaloID,\
                PROG.MassType_Star as ms, \
                PROG.SnapNum \
            FROM \
                %s_Subhalo as PROG, \
                %s_Subhalo as DES \
            WHERE \
                DES.SnapNum = 28 \
                and PROG.GalaxyID between DES.GalaxyID and DES.LastProgID \
                and PROG.MassType_Star > 1.0e8  \
                and PROG.Spurious = 0 \
                and DES.Spurious = 0 \
            ORDER BY \
                DES.GalaxyID desc, \
                DES.GroupID desc, \
                PROG.GroupID desc, \
                PROG.MassType_Star desc, \
                PROG.SnapNum desc"%(name,name)
        query_out = sql.execute_query(con, myQuery)
        
        ex = np.transpose(query_out)
        
        #Write json files:
        jsonfile = open('static/data/' + str(name) + '_galaxySequence.json', 'w')
        jsonfile.write('[')

        for row in ex:
            entr = {'galID':row[0].tolist(),'desHaloID':row[1].tolist(),'progGalaxyID':row[2].tolist(),'progHaloID':row[3].tolist(),'progMassType_Star':row[4].tolist(),'progSnapNum':row[5].tolist(),}
            json.dump(entr, jsonfile, separators=(',', ':'))
            if row == ex[-1]:
                jsonfile.write(']')

            else:
                jsonfile.write(',\n')

        # jsonfile.write(']')

# Array of chosen simulations. Entries refer to the simulation name and comoving box length.
# mySims = np.array([('RefL0100N1504', 100.), ('RefL0025N0376', 25.), ('RefL0012N0188', 12.5)])
con = sql.connect("psf414", password="LSM83gls") #FH id and password


mySims = np.array([('RefL0012N0188', 12.5)])
return_sql_query(mySims,con)


# This uses the eagleSqlTools module to connect to the database with your username and password. # If the password is not given, the module will prompt for it.

