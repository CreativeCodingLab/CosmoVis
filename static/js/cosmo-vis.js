/**
 * ! CosmoVis - Volumetric Rendering version
 */


/**
 * * Instantiate global variables
 */

var container //floating GUI containers

var camera, scene, renderer, material, skewerScene //THREE.js environment variables
var tex1 = new THREE.TextureLoader().load( "static/textures/blur.png" );
const windowHalf = new THREE.Vector2( window.innerWidth / 2, window.innerHeight / 2 );
var field_list //contains list of particle fields
var gasMinCol, gasMidCol, gasMaxCol, dmMinCol, dmMaxCol, starMinCol, starMaxCol, bhMinCol, bhMaxCol //stores colors for different particle types
var gm, gmx, bhm, bhmx //used for changeValue()
var brusher //used for spectra brush
var gui //used to hold dat.GUI object
// var material
var cmtexture = []
var gasTexture, dmTexture
var uniforms
var densityTexture, densityMin, densityMax
var gasMesh, dmMesh, starMesh, bhMesh
var gasMaterial, dmMaterial, starMaterial, bhMaterial, volMaterial
var climGasLimits = []
var climDMLimits = []
var climStarLimits = []
var climBHLimits = []
var gridsize = 64
var simID
var simSize
var staticGrid

var blank_d = new Float32Array(gridsize * gridsize * gridsize)
for(x=0;x<gridsize;x++){
    for(y=0;y<gridsize;y++){
        for(z=0;z<gridsize;z++){
            blank_d[ x + y * gridsize + z * gridsize * gridsize ] = 1.0
        }
    }
}
// console.log(d)
blankTexture = new THREE.DataTexture3D( blank_d, gridsize, gridsize, gridsize)
blankTexture.format = THREE.RedFormat
blankTexture.type = THREE.FloatType
blankTexture.minFilter = blankTexture.magFilter = THREE.LinearFilter
blankTexture.unpackAlignment = 1
blank_d = []

var elements = ['Hydrogen','Helium','Carbon','Nickel','Oxygen','Neon','Magnesium','Silicon','Iron']
// var volconfig

/**
 * * these variables are used for raycasting when drawing skewers
 */
var cube
const mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var plane = new THREE.Plane();
var planeNormal = new THREE.Vector3();
var point = new THREE.Vector3();
var edges = []
var skewers = []
var drawSkewers = false
var line
var lines = []
var container_hover //used to determine if the mouse is over a GUI container when drawing skewers
var edges_scaled = []
var domainXYZ = [0.0,1.0,0.0,1.0,0.0,1.0]

/**
 * * used with refreshLoop() to get fps
 */
const times = [];
let fps;
var camPos;

// var staticGrid;

/**
 * * GLOBAL FUNCTIONS 
 */

function clearThree(obj){
    /**
     * * removes THREE.js objects and materials from memory more efficiently than just by setting `scene = []`
     */
    while(obj.children.length > 0){ 
      clearThree(obj.children[0])
      obj.remove(obj.children[0]);
    }
    if(obj.geometry) obj.geometry.dispose()
  
    if(obj.material){ 
      //in case of map, bumpMap, normalMap, envMap ...
      Object.keys(obj.material).forEach(prop => {
        if(!obj.material[prop])
          return         
        if(typeof obj.material[prop].dispose === 'function')                                  
          obj.material[prop].dispose()                                                        
      })
      obj.material.dispose()
    }
}

function clearLayer(l){
    /**
     * * removes material from THREE.js layer to free up memory
     */

    for( i = scene.children.length - 1; i >= 0 ; i-- ){
        layer = scene.children[i].layers.mask
        if(l==0 && layer == 1){     
            console.log('clear') 
            scene.remove(scene.children[i])
        }
        if(l==1 && layer == 2){
            scene.remove(scene.children[i])
        }
        if(l==2 && layer == 3){
            scene.remove(scene.children[i])
        }
        if(l==3 && layer == 4){
            scene.remove(scene.children[i])
        }
        if(l==9 && layer == 512){
            scene.remove(scene.children[i])
            console.log('clear')
        }
        if(l == 10 && layer == 1024){
            scene.remove(scene.children[i])
        }
    } 
    
}


function updateSize(){
    s = document.getElementById("size_select").value
    //check to see if selected size is different than the current configuration

    let oldSize = gridsize
    let oldPos = camera.position


    if(gridsize != s){
        gridsize = s

        camera.position.set(oldPos.x * gridsize / oldSize, oldPos.y * gridsize / oldSize, oldPos.z * gridsize / oldSize)
        // camera.lookAt(gridsize/2,  gridsize/2,  gridsize/2)
        // camera.zoom = 6
        camera.updateProjectionMatrix()
        controls.target.set( gridsize/2,  gridsize/2,  gridsize/2 );
    
        
        asyncCall()
        //check to see which variables are visible and update those immediately
        

        loadGasDMAttributes(gridsize,'Temperature',true)


        
        createSkewerCube(gridsize)
        updateSkewerEndpoints(gridsize)
        toggleXYZGuide()
        updateUniforms()
        toggleGrid()
        
    }
}

function loadAttributes(){
    // if(document.getElementById("gas-eye-open").style.display == "inline-block"){
        loadAttribute(gridsize,'PartType0','Temperature',true)
    // }
    // if(document.getElementById("dm-eye-open").style.display == "inline-block"){
        loadAttribute(gridsize,'PartType1','density',true)
    // }
    // if(document.getElementById("star-eye-open").style.display = "inline-block"){
        loadAttribute(gridsize,'PartType4','density',true)
    // }
    // if(document.getElementById("bh-eye-open").style.display = "inline-block"){
        
    // }
}

function toggleGrid(){
    let div = (document.getElementById("grid-check")).checked
    let divGridRadio1 = (document.getElementById("grid-radio-1")).checked
    let divGridRadio2 = (document.getElementById("grid-radio-2")).checked

    if(div){
        clearLayer(9)
        if(divGridRadio1){
            createStaticGrid()
        }
        if(divGridRadio2){
            createBoundariesGrid()
        }
        
        createSkewerCube(gridsize)
        updateSkewerEndpoints(gridsize)
        toggleXYZGuide()
        updateUniforms()

    }
    else{
        clearLayer(9)
    }
    
}

// function toggleGrid(){
//     let div = (document.getElementById("grid-check")).checked
    
    
//     if(div){
//         camera.layers.toggle( 9 )
//     }
//     else{
//         camera.layers.toggle( 9 )
//     }
// }

function toggleXYZGuide(){
    
    let div = (document.getElementById("xyzguide-check")).checked
    if(div){
        var axesHelper = new THREE.AxesHelper( gridsize );
        axesHelper.layers.set(10)
        scene.add( axesHelper );
    }
    else{
        clearLayer(10)
    }
}

function updateSkewerEndpoints(size){
    for(i=0;i<lines.length;i++){
        lines[i].scale.x = size/64
        lines[i].scale.y = size/64
        lines[i].scale.z = size/64
    }
}

function createStaticGrid(){
    clearLayer(9)
    
    gridMaterial = new THREE.MeshBasicMaterial

    var divisions = simSize;

    staticGrid = new THREE.GridHelper( gridsize*1.7, divisions*1.7, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) )
    staticGrid.position.set(gridsize/2,gridsize/2,gridsize/2)
    staticGrid.layers.set(9)
    staticGrid.material.transparent = true;
    staticGrid.material.alpha = 0.01;
    // gridHelper.translateX( gridsize / 2);
    // gridHelper.translateY( gridsize / 2);
    // gridHelper.translateZ( gridsize / 2);
    staticGrid.side = THREE.DoubleSide
    scene.add( staticGrid );
}

function createBoundariesGrid(){
    clearLayer(9)
        
    divisions = simSize

    var gridHelper = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper.position.set(0,-gridsize/2,0)
    gridHelper.layers.set(9)
    gridHelper.material.transparent = true;
    gridHelper.material.alpha = 0.01;
    gridHelper.translateX( gridsize / 2);
    gridHelper.translateY( gridsize / 2);
    gridHelper.translateZ( gridsize / 2);
    gridHelper.side = THREE.DoubleSide
    scene.add( gridHelper );

    var gridHelper1 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper1.position.set(0,1*gridsize,-gridsize/2)
    gridHelper1.rotateX(Math.PI/2)
    gridHelper1.layers.set(9)
    gridHelper1.material.transparent = true;
    gridHelper1.material.alpha = 0.01;
    gridHelper1.translateX( gridsize / 2);
    gridHelper1.translateY( gridsize / 2);
    gridHelper1.translateZ( gridsize / 2);
    gridHelper1.side = THREE.DoubleSide
    scene.add( gridHelper1 );

    var gridHelper2 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper2.position.set(gridsize/2,0,0)
    gridHelper2.rotateZ(Math.PI/2)
    gridHelper2.layers.set(9)
    gridHelper2.material.transparent = true;
    gridHelper2.material.alpha = 0.01;
    gridHelper2.translateX( gridsize / 2);
    gridHelper2.translateY( gridsize / 2);
    gridHelper2.translateZ( gridsize / 2);
    gridHelper2.side = THREE.DoubleSide
    scene.add( gridHelper2 );

    var gridHelper3 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper3.position.set(0,gridsize/2,0)
    gridHelper3.layers.set(9)
    gridHelper3.material.transparent = true;
    gridHelper3.material.alpha = 0.01;
    gridHelper3.translateX( gridsize / 2);
    gridHelper3.translateY( gridsize / 2);
    gridHelper3.translateZ( gridsize / 2);
    gridHelper3.side = THREE.DoubleSide
    scene.add( gridHelper3 );

    var gridHelper4 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper4.position.set(0,1*gridsize,gridsize/2)
    gridHelper4.rotateX(Math.PI/2)
    gridHelper4.layers.set(9)
    gridHelper4.material.transparent = true;
    gridHelper4.material.alpha = 0.01;
    gridHelper4.translateX( gridsize / 2);
    gridHelper4.translateY( gridsize / 2);
    gridHelper4.translateZ( gridsize / 2);
    gridHelper4.side = THREE.DoubleSide
    scene.add( gridHelper4 );

    var gridHelper5 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x005817 ), new THREE.Color( 0x005817 ) );
    gridHelper5.position.set(1.5*gridsize,0,0)
    gridHelper5.rotateZ(Math.PI/2)
    gridHelper5.layers.set(9)
    gridHelper5.material.transparent = true;
    gridHelper5.material.alpha = 0.01;
    gridHelper5.translateX( gridsize / 2);
    gridHelper5.translateY( gridsize / 2);
    gridHelper5.translateZ( gridsize / 2);
    gridHelper5.side = THREE.DoubleSide
    scene.add( gridHelper5 );
}

function toggleXYZGuide(){
    
    let div = (document.getElementById("xyzguide-check")).checked
    if(div){
        var axesHelper = new THREE.AxesHelper( gridsize );
        axesHelper.layers.set(10)
        scene.add( axesHelper );
    }
    else{
        clearLayer(10)
    }
}

function updateSkewerEndpoints(size){
    for(i=0;i<lines.length;i++){
        lines[i].scale.x = size/64
        lines[i].scale.y = size/64
        lines[i].scale.z = size/64
    }
}

function updateUniforms(){
    if(volMaterial){
        w = 256
        h = 1
        size = w * h
        
        
        //check if grayscale depth is enabled
        g_mod = (document.getElementById("grayscale-mod-check").checked ? 1.0 : 0.0);
        volMaterial.uniforms[ "u_grayscaleDepthMod" ].value = g_mod;

        //step size
        volMaterial.uniforms[ "u_stepSize" ].value = document.getElementById("step-size").value
        volMaterial.uniforms[ "u_exposure" ].value = document.getElementById("exposure").value
        
        //cutting sliders
        volMaterial.uniforms[ "u_xyzMin" ].value = new THREE.Vector3(domainXYZ[0],domainXYZ[2],domainXYZ[4])
        volMaterial.uniforms[ "u_xyzMax" ].value = new THREE.Vector3(domainXYZ[1],domainXYZ[3],domainXYZ[5])

        volMaterial.uniforms[ "u_distModI" ].value = (document.getElementById("dist-mod-intensity")).value
        volMaterial.uniforms[ "u_valModI" ].value = (document.getElementById("val-mod-intensity")).value


        d_mod = (document.getElementById("density-mod-check").checked ? 1.0 : 0.0);
        
        //do stuff with h_number_density
        densityMin = document.getElementById('density-minval-input').value
        densityMax = document.getElementById('density-maxval-input').value
        if(d_mod == 1.0){
            volMaterial.uniforms[ "u_density" ].value = densityTexture;
            volMaterial.uniforms[ " u_grayscaleDepthMod" ]
            volMaterial.uniforms[ "u_climDensity" ].value.set( densityMin, densityMax );
        }
        else{
            volMaterial.uniforms[ "u_density" ].value = blankTexture;
            volMaterial.uniforms[ "u_climDensity" ].value.set( 1.0, 1.0 );
            // d = []
        }
        volMaterial.uniforms[  "u_densityDepthMod"  ].value = d_mod;
        volMaterial.uniforms[ "u_densityModI" ].value = (document.getElementById("density-mod-intensity")).value
        if((document.getElementById("density-mod-check")).checked){
            volMaterial.uniforms[ "u_densityMod" ].value = 1.0;
        }
        else{
            volMaterial.uniforms[ "u_densityMod" ].value = 0.0;
        }


        if((document.getElementById("dist-mod-check")).checked){
            volMaterial.uniforms[ "u_distMod" ].value = 1.0;
        }
        else{
            volMaterial.uniforms[ "u_distMod" ].value = 0.0;
        }

        if((document.getElementById("val-mod-check")).checked){
            volMaterial.uniforms[ "u_valMod" ].value = 1.0;
        }
        else{
            volMaterial.uniforms[ "u_valMod" ].value = 0.0;
        }

        //store values in local storage cache
        localStorage.setItem('gasMinVal',(document.getElementById('gas-minval-input')).value);
        localStorage.setItem('gasMaxVal',(document.getElementById('gas-maxval-input')).value);
        
        localStorage.setItem('dmMinVal', (document.getElementById('dm-minval-input')).value);
        localStorage.setItem('dmMaxVal', (document.getElementById('dm-maxval-input')).value);

        //check if "min/max" checks are enabled to disable the number input
        document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
        document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);

        if(document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked){
            volMaterial.uniforms[ "u_gasClim" ].value.set( climGasLimits[0] , climGasLimits[1] );
        }
        else if(document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked){
            volMaterial.uniforms[ "u_gasClim" ].value.set( climGasLimits[0] , document.querySelector('#gas-maxval-input').value );
        }
        else if(!document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked){
            volMaterial.uniforms[ "u_gasClim" ].value.set( document.querySelector('#gas-minval-input').value , climGasLimits[1] );
        }
        else if(!document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked){
            volMaterial.uniforms[ "u_gasClim" ].value.set( document.querySelector('#gas-minval-input').value , document.querySelector('#gas-maxval-input').value );
        }
        else{

        }

        volMaterial.uniforms[ "u_gasClip" ].value = [ document.getElementById("gas-min-clip-check").checked, document.getElementById("gas-max-clip-check").checked ]
        
        gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
        gasMidCol = new THREE.Color(document.querySelector("#gasMidCol").value);
        gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
        
        gasColData = new Uint8Array(3 * 256)
        for(i=0;i<w;i++){
            stride = i * 3
            a = i/w
            if(i<w/2){
                c = gasMinCol.clone().lerp(gasMidCol,a)
            }
            else{
                c = gasMidCol.clone().lerp(gasMaxCol,a)
            }
            gasColData[stride] = Math.floor(c.r*255)
            gasColData[stride+1] = Math.floor(c.g*255)
            gasColData[stride+2] = Math.floor(c.b*255)
        }
        cmtexture['PartType0'] = new THREE.DataTexture(gasColData,w,h,THREE.RGBFormat)
        gasColData = []
        volMaterial.uniforms[ "u_cmGasData" ].value = cmtexture['PartType0'];

        //dm data

        document.getElementById("dm-minval-input").disabled = (document.getElementById("dm-min-check").checked);
        document.getElementById("dm-maxval-input").disabled = (document.getElementById("dm-max-check").checked);

        if(document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked){
            volMaterial.uniforms[ "u_dmClim" ].value.set( climDMLimits[0] , climDMLimits[1] );
        }
        else if(document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked){
            volMaterial.uniforms[ "u_dmClim" ].value.set( climDMLimits[0] , document.querySelector('#dm-maxval-input').value );
        }
        else if(!document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked){
            volMaterial.uniforms[ "u_dmClim" ].value.set( document.querySelector('#dm-minval-input').value , climDMLimits[1] );
        }
        else if(!document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked){
            volMaterial.uniforms[ "u_dmClim" ].value.set( document.querySelector('#dm-minval-input').value , document.querySelector('#dm-maxval-input').value );
        }
        
        volMaterial.uniforms[ "u_dmClip" ].value = [ document.getElementById("dm-min-clip-check").checked, document.getElementById("dm-max-clip-check").checked ]

        dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
        dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
        
        dmColData = new Uint8Array(3 * 256)
        for(i=0;i<w;i++){
            stride = i * 3
            a = i/w
            c = dmMinCol.clone().lerp(dmMaxCol.clone(),a)
            dmColData[stride] = Math.floor(c.r*255)
            dmColData[stride+1] = Math.floor(c.g*255)
            dmColData[stride+2] = Math.floor(c.b*255)
        }
        cmtexture['PartType1'] = new THREE.DataTexture(dmColData,w,h,THREE.RGBFormat)
        dmColData = []
        volMaterial.uniforms[ "u_cmDMData" ].value = cmtexture['PartType1'];
    }
    
}

function updateUniforms_deprecated() {
    // console.log('updateUniforms')
    w = 256
    h = 1
    size = w * h
    d_mod = (document.getElementById("density-mod-check").checked ? 1.0 : 0.0);
    densityMin = document.getElementById('density-minval-input').value
    densityMax = document.getElementById('density-maxval-input').value
    g_mod = (document.getElementById("grayscale-mod-check").checked ? 1.0 : 0.0);
    // dither = (document.getElementById("dither-check").checked ? 1.0 : 0.0);

    localStorage.setItem('gasMinVal',(document.getElementById('gas-minval-input')).value);
    localStorage.setItem('gasMaxVal',(document.getElementById('gas-maxval-input')).value);
    
    // localStorage.setItem('dmCol', "#" + dmCol.getHexString());
    localStorage.setItem('dmMinVal',(document.getElementById('dm-minval-input')).value);
    localStorage.setItem('dmMaxVal',(document.getElementById('dm-maxval-input')).value);
    
    localStorage.setItem('starMinVal',(document.getElementById('star-minval-input')).value);
    localStorage.setItem('starMaxVal',(document.getElementById('star-maxval-input')).value);

    localStorage.setItem('bhMinVal',(document.getElementById('bh-minval-input')).value);
    localStorage.setItem('bhMaxVal',(document.getElementById('bh-maxval-input')).value);

    if(gasMaterial){
        document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
        document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);
        
        if(document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked){
            gasMaterial.uniforms[ "u_clim" ].value.set( climGasLimits[0] , climGasLimits[1] );
        }
        else if(document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked){
            gasMaterial.uniforms[ "u_clim" ].value.set( climGasLimits[0] , document.querySelector('#gas-maxval-input').value );
        }
        else if(!document.getElementById("gas-min-check").checked && document.getElementById("gas-max-check").checked){
            gasMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#gas-minval-input').value , climGasLimits[1] );
        }
        else if(!document.getElementById("gas-min-check").checked && !document.getElementById("gas-max-check").checked){
            gasMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#gas-minval-input').value , document.querySelector('#gas-maxval-input').value );
        }
        
        // gasMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#gas-minval-input').value, document.querySelector('#gas-maxval-input').value );
        gasMaterial.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        gasMaterial.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        gasMaterial.uniforms[ "u_clip" ].value = [ document.getElementById("gas-min-clip-check").checked, document.getElementById("gas-max-clip-check").checked ]
        gasMaterial.uniforms[  "u_densityDepthMod" ].value = d_mod;
        if(d_mod == 1.0){
            gasMaterial.uniforms[ "u_density" ].value = densityTexture;
            gasMaterial.uniforms[ " u_grayscaleDepthMod" ]
            gasMaterial.uniforms[ "u_climDensity" ].value.set( densityMin, densityMax );
        }
        else{
            gasMaterial.uniforms[ "u_density" ].value = blankTexture;
            gasMaterial.uniforms[ "u_climDensity" ].value.set( 1.0, 1.0 );
            d = []
        }
        gasMaterial.uniforms[ "u_grayscaleDepthMod" ].value = g_mod;
        // gasMaterial.uniforms[ "u_dither" ].value = dither;
        gasMaterial.uniforms[ "u_stepSize" ].value = document.getElementById("step-size").value
        gasMaterial.uniforms[ "u_xyzMin" ].value = new THREE.Vector3(domainXYZ[0],domainXYZ[2],domainXYZ[4])
        gasMaterial.uniforms[ "u_xyzMax" ].value = new THREE.Vector3(domainXYZ[1],domainXYZ[3],domainXYZ[5])

        gasMaterial.uniforms[ "u_densityModI" ].value = (document.getElementById("density-mod-intensity")).value
        gasMaterial.uniforms[ "u_distModI" ].value = (document.getElementById("dist-mod-intensity")).value
        gasMaterial.uniforms[ "u_valModI" ].value = (document.getElementById("val-mod-intensity")).value

        if((document.getElementById("density-mod-check")).checked){
            gasMaterial.uniforms[ "u_densityMod" ].value = 1.0;
        }
        else{
            gasMaterial.uniforms[ "u_densityMod" ].value = 0.0;
        }


        if((document.getElementById("dist-mod-check")).checked){
            gasMaterial.uniforms[ "u_distMod" ].value = 1.0;
        }
        else{
            gasMaterial.uniforms[ "u_distMod" ].value = 0.0;
        }

        if((document.getElementById("val-mod-check")).checked){
            gasMaterial.uniforms[ "u_valMod" ].value = 1.0;
        }
        else{
            gasMaterial.uniforms[ "u_valMod" ].value = 0.0;
        }

        if((document.getElementById("dist-mod-check")).checked){
            gasMaterial.uniforms[ "u_distMod" ].value = 1.0;
        }
        else{
            gasMaterial.uniforms[ "u_distMod" ].value = 0.0;
        }

        if((document.getElementById("val-mod-check")).checked){
            gasMaterial.uniforms[ "u_valMod" ].value = 1.0;
        }
        else{
            gasMaterial.uniforms[ "u_valMod" ].value = 0.0;
        }

        gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
        gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
        
        data = new Uint8Array(3 * size)
        for(i=0;i<w;i++){
            stride = i * 3
            a = i/w
            if(i<w/2){
                c = gasMinCol.clone().lerp(gasMidCol,a)
            }
            else{
                c = gasMidCol.clone().lerp(gasMaxCol,a)
            }
            data[stride] = Math.floor(c.r*255)
            data[stride+1] = Math.floor(c.g*255)
            data[stride+2] = Math.floor(c.b*255)
        }
        cmtexture = new THREE.DataTexture(data,w,h,THREE.RGBFormat)
        data = []
        gasMaterial.uniforms[ "u_cmdata" ].value = cmtexture;
    }
    
    if(dmMaterial){

        document.getElementById("dm-minval-input").disabled = (document.getElementById("dm-min-check").checked);
        document.getElementById("dm-maxval-input").disabled = (document.getElementById("dm-max-check").checked);
        if(document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked){
            dmMaterial.uniforms[ "u_clim" ].value.set( climDMLimits[0] , climDMLimits[1] );
        }
        else if(document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked){
            dmMaterial.uniforms[ "u_clim" ].value.set( climDMLimits[0] , document.querySelector('#dm-maxval-input').value );
        }
        else if(!document.getElementById("dm-min-check").checked && document.getElementById("dm-max-check").checked){
            dmMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#dm-minval-input').value , climDMLimits[1] );
        }
        else if(!document.getElementById("dm-min-check").checked && !document.getElementById("dm-max-check").checked){
            dmMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#dm-minval-input').value , document.querySelector('#dm-maxval-input').value );
        }

        // dmMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#dm-minval-input').value, document.querySelector('#dm-maxval-input').value );
        dmMaterial.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        dmMaterial.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        dmMaterial.uniforms[ "u_clip" ].value = [ document.getElementById("dm-min-clip-check").checked, document.getElementById("dm-max-clip-check").checked ]
        dmMaterial.uniforms[  "u_densityDepthMod" ].value = d_mod;
        if(d_mod == 1.0){
            dmMaterial.uniforms[ "u_density" ].value = densityTexture;
            dmMaterial.uniforms[ " u_grayscaleDepthMod" ]
            dmMaterial.uniforms[ "u_climDensity" ].value.set( densityMin, densityMax );
        }
        else{
            dmMaterial.uniforms[ "u_density" ].value = blankTexture;
            dmMaterial.uniforms[ "u_climDensity" ].value.set( 1.0, 1.0 );
            d = []
        }
        dmMaterial.uniforms[ "u_grayscaleDepthMod" ].value = g_mod;
        // dmMaterial.uniforms[ "u_dither" ].value = dither;
        dmMaterial.uniforms[ "u_stepSize" ].value = document.getElementById("step-size").value
        dmMaterial.uniforms[ "u_xyzMin" ].value = new THREE.Vector3(domainXYZ[0],domainXYZ[2],domainXYZ[4])
        dmMaterial.uniforms[ "u_xyzMax" ].value = new THREE.Vector3(domainXYZ[1],domainXYZ[3],domainXYZ[5])

        dmMaterial.uniforms[ "u_densityModI" ].value = (document.getElementById("density-mod-intensity")).value
        dmMaterial.uniforms[ "u_distModI" ].value = (document.getElementById("dist-mod-intensity")).value
        dmMaterial.uniforms[ "u_valModI" ].value = (document.getElementById("val-mod-intensity")).value


        if((document.getElementById("dist-mod-check")).checked){
            dmMaterial.uniforms[ "u_distMod" ].value = 1.0;
        }
        else{
            dmMaterial.uniforms[ "u_distMod" ].value = 0.0;
        }

        if((document.getElementById("val-mod-check")).checked){
            dmMaterial.uniforms[ "u_valMod" ].value = 1.0;
        }
        else{
            dmMaterial.uniforms[ "u_valMod" ].value = 0.0;
        }

        dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
        dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
        
        data = new Uint8Array(3 * size)
        for(i=0;i<w;i++){
            stride = i * 3
            a = i/w
            c = dmMinCol.clone().lerp(dmMaxCol,a)
            data[stride] = Math.floor(c.r*255)
            data[stride+1] = Math.floor(c.g*255)
            data[stride+2] = Math.floor(c.b*255)
        }
        cmtexture = new THREE.DataTexture(data,w,h,THREE.RGBFormat)
        data = []
        dmMaterial.uniforms[ "u_cmdata" ].value = cmtexture;
    }
    if(starMaterial){

        document.getElementById("star-minval-input").disabled = (document.getElementById("star-min-check").checked);
        document.getElementById("star-maxval-input").disabled = (document.getElementById("star-max-check").checked);
        if(document.getElementById("star-min-check").checked && document.getElementById("star-max-check").checked){
            starMaterial.uniforms[ "u_clim" ].value.set( climDMLimits[0] , climDMLimits[1] );
        }
        else if(document.getElementById("star-min-check").checked && !document.getElementById("star-max-check").checked){
            starMaterial.uniforms[ "u_clim" ].value.set( climDMLimits[0] , document.querySelector('#star-maxval-input').value );
        }
        else if(!document.getElementById("star-min-check").checked && document.getElementById("star-max-check").checked){
            starMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#star-minval-input').value , climDMLimits[1] );
        }
        else if(!document.getElementById("star-min-check").checked && !document.getElementById("dm-max-check").checked){
            starMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#star-minval-input').value , document.querySelector('#star-maxval-input').value );
        }

        // dmMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#dm-minval-input').value, document.querySelector('#dm-maxval-input').value );
        starMaterial.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        starMaterial.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        starMaterial.uniforms[ "u_clip" ].value = [ document.getElementById("star-min-clip-check").checked, document.getElementById("star-max-clip-check").checked ]
        starMaterial.uniforms[ "u_xyzMin" ].value = new THREE.Vector3(domainXYZ[0],domainXYZ[2],domainXYZ[4])
        starMaterial.uniforms[ "u_xyzMax" ].value = new THREE.Vector3(domainXYZ[1],domainXYZ[3],domainXYZ[5])

        starMaterial.uniforms[ "u_densityModI" ].value = (document.getElementById("density-mod-intensity")).value
        starMaterial.uniforms[ "u_distModI" ].value = (document.getElementById("dist-mod-intensity")).value
        starMaterial.uniforms[ "u_valModI" ].value = (document.getElementById("val-mod-intensity")).value

        if((document.getElementById("dist-mod-check")).checked){
            starMaterial.uniforms[ "u_distMod" ].value = 1.0;
        }
        else{
            starMaterial.uniforms[ "u_distMod" ].value = 0.0;
        }

        if((document.getElementById("val-mod-check")).checked){
            starMaterial.uniforms[ "u_valMod" ].value = 1.0;
        }
        else{
            starMaterial.uniforms[ "u_valMod" ].value = 0.0;
        }

        starMinCol = new THREE.Color(document.querySelector("#starMinCol").value);
        starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);
        
        data = new Uint8Array(3 * size)
        for(i=0;i<w;i++){
            stride = i * 3
            a = i/w
            c = starMinCol.clone().lerp(starMaxCol,a)
            data[stride] = Math.floor(c.r*255)
            data[stride+1] = Math.floor(c.g*255)
            data[stride+2] = Math.floor(c.b*255)
        }
        cmtexture = new THREE.DataTexture(data,w,h,THREE.RGBFormat)
        data = []
        starMaterial.uniforms[ "u_cmdata" ].value = cmtexture;
    }
    // render()
    
}

async function asyncCall() {
    var dens = await loadDensity(gridsize,'PartType0','H_number_density')
    // console.log(dens)
    // densityTexture = dens[0]
    densityMin = dens[1]
    densityMax = dens[2]
    dens = []
    // animate()
    // render()
    
    // loadAttribute(128,'PartType0','Temperature',true)
    // loadAttribute(gridsize,'PartType0','Temperature',true)
    // loadAttribute(gridsize,'PartType1','density',true)
    // loadAttribute(gridsize,'PartType4','density',true)
}

function loadDensity(size,type,attr){
    
    return new Promise(resolve => {
        d3.json('static/data/'+simID+'/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(d){
            arr = new Float32Array(size * size * size)
            for(x=0;x<size;x++){
                for(y=0;y<size;y++){
                    for(z=0;z<size;z++){
                        arr[ x + y * size + z * size * size ] = Math.log10(d[x][y][z])
                    }
                }
            }
            d = []

            densityMax = arr.reduce(function(a, b) {
                return Math.max(a, b);
            });
            densityMin = arr.reduce(function(a, b) {
                return Math.min(a, b);
            });

            setDensityMinMaxInputValues('density',densityMin,densityMax)

            function setDensityMinMaxInputValues(type,min,max){
                let minval = document.getElementById(type+'-minval-input')
                minval.value = round(min,2)
                let maxval = document.getElementById(type+'-maxval-input')
                maxval.value = round(max,2)
            }

            dm = document.querySelector('#density-minval-input')
            dm.addEventListener('input', updateUniforms);
            dmx = document.querySelector('#density-maxval-input')
            dmx.addEventListener('input', updateUniforms);

            densityTexture = new THREE.DataTexture3D( arr, size, size, size)
            densityTexture.format = THREE.RedFormat
            densityTexture.type = THREE.FloatType
            densityTexture.minFilter = densityTexture.magFilter = THREE.LinearFilter
            densityTexture.unpackAlignment = 1
            
            // if(densityMin == -Infinity){
            //     densityMin = 0.0000000000001
            // }
            arr = []
            resolve([densityTexture, densityMin, densityMax])
        })
    })

}

function loadGasDMAttributes(size,attr,resolution_bool){

    type='PartType0'
    d3.json('static/data/'+simID+'/PartType0/' + size + '_' + type + '_' + attr +'.json').then(function(d){
        clearLayer(0)
        
        //arr holds the flattened data in Float32Array to be used as a 3D texture
        gasArr = new Float32Array(size * size * size)

        let log
        if(elements.includes(attr)){
            log = false
        }
        else{
            log = true
        }    
        
        log = true
        //fill arr array with loaded data
        for(x=0;x<size;x++){
            for(y=0;y<size;y++){
                for(z=0;z<size;z++){
                    if(log){
                        gasArr[ x + y * size + z * size * size ] =  Math.log10(d[x][y][z])
                    }
                    else{
                        gasArr[ x + y * size + z * size * size ] =  d[x][y][z]
                    }
                }
            }
        }
        // console.log(arr)
        d = [] //clear loaded data since it is no longer needed

        //find the min and max values in the dataset and set the values in the container GUI input boxes
        var min = gasArr.reduce(function(a, b) {
            return Math.min(a, b);
        });
        var max = gasArr.reduce(function(a, b) {
            return Math.max(a, b);
        });
        console.log(min)
        if(min==-Infinity){min = -999999999999}
        var x = document.getElementById("gas-eye-open");
        x.style.display = "inline-block";
        var y = document.getElementById("gas-eye-closed");
        y.style.display = "none";
        if(resolution_bool && localStorage.getItem('gasMinVal') != ""){
            min = localStorage.getItem('gasMinVal')
        }
        if(resolution_bool && localStorage.getItem('gasMaxVal') != ""){
            max = localStorage.getItem('gasMaxVal')
        }
        climGasLimits = [min, max]
        let minval = document.getElementById('gas-minval-input')
        minval.value = round(min,2)
        let maxval = document.getElementById('gas-maxval-input')
        maxval.value = round(max,2)

        var gasTexture = new THREE.DataTexture3D( gasArr, size, size, size)
        gasTexture.format = THREE.RedFormat
        gasTexture.type = THREE.FloatType
        gasTexture.minFilter = gasTexture.magFilter = THREE.LinearFilter
        gasTexture.unpackAlignment = 1


        
        type='PartType1'
        attr = 'density'
        d3.json('static/data/'+simID+'/PartType1/' + size + '_' + type + '_' + attr +'.json').then(function(d){
            // clearLayer(1)

            dmArr = new Float32Array(size * size * size)

            // let log = true
            // if(elements.includes(attr)){
            //     log = false
            // }
            // else{
            //     log = true
            // }    
            
            log = true
            //fill arr array with loaded data
            for(x=0;x<size;x++){
                for(y=0;y<size;y++){
                    for(z=0;z<size;z++){
                        if(log){
                            dmArr[ x + y * size + z * size * size ] =  Math.log10(d[x][y][z])
                        }
                        else{
                            dmArr[ x + y * size + z * size * size ] =  d[x][y][z]
                        }
                    }
                }
            }

            // console.log(arr)
            d = [] //clear loaded data since it is no longer needed  
            
            var max = dmArr.reduce(function(a, b) {
                return Math.max(a, b);
            });
            var min = dmArr.reduce(function(a, b) {
                return Math.min(a, b);
            });
            console.log(min)
            if(min==-Infinity){min = -999999999999}

            var x = document.getElementById("dm-eye-open");
            x.style.display = "inline-block";
            var y = document.getElementById("dm-eye-closed");
            y.style.display = "none";
            if(localStorage.getItem('dmMinVal') != ""){
                min = localStorage.getItem('dmMinVal')
            }
            if(localStorage.getItem('dmMaxVal') != ""){
                max = localStorage.getItem('dmMaxVal')
            }
            climDMLimits = [min, max]

            let minval = document.getElementById('dm-minval-input')
            minval.value = round(min,2)
            let maxval = document.getElementById('dm-maxval-input')
            maxval.value = round(max,2)
            
            var dmTexture = new THREE.DataTexture3D( dmArr, size, size, size)
            dmTexture.format = THREE.RedFormat
            dmTexture.type = THREE.FloatType
            dmTexture.minFilter = dmTexture.magFilter = THREE.LinearFilter
            dmTexture.unpackAlignment = 1
            var shader = THREE.VolumeRenderShader1;
            var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

            gasArr = []
            dmArr = []

            initColor('PartType0')
            initColor('PartType1')

            // uniforms[ "u_data" ].value = texture;
            uniforms[ "u_gasData" ].value = gasTexture;
            uniforms[ "u_dmData" ].value = dmTexture;
            uniforms[ "u_size" ].value.set( size, size, size );
            uniforms[ "u_gasClim" ].value.set( climGasLimits[0], climGasLimits[1] );
            uniforms[ "u_dmClim" ].value.set( climDMLimits[0], climDMLimits[1] );
            uniforms[ "u_renderstyle" ].value = 'mip' == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
            uniforms[ "u_renderthreshold" ].value = 1.0; // For ISO renderstyle
            uniforms[ "u_cmGasData" ].value = cmtexture['PartType0'];
            uniforms[ "u_cmDMData" ].value = cmtexture['PartType1'];
            uniforms[ "u_gasClip" ].value = [true, true]
            uniforms[ "u_dmClip" ].value = [true, true]


            var material = new THREE.ShaderMaterial( {
                uniforms: uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
                clipping: true,
                side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
                transparent: true,
                // opacity: 0.05,

                // blending: THREE.CustomBlending,
                blendEquation: THREE.AddEquation,
                blendSrc: THREE.OneFactor,
                blendDst: THREE.OneMinusSrcAlphaFactor,
                depthWrite: false,
            } );

            volMaterial = material

            // THREE.Mesh
            var geometry = new THREE.BoxGeometry( size, size, size );
            geometry.translate( size / 2, size / 2, size / 2 );

            createSkewerCube(size)

            var mesh = new THREE.Mesh( geometry, material );
            mesh.layers.set(0)
            mesh.renderOrder = 1
            volMesh = mesh

            updateUniforms()
            scene.add( mesh );

            gm = document.querySelector('#gas-minval-input')
            gm.addEventListener('input', updateUniforms);
            gmx = document.querySelector('#gas-maxval-input')
            gmx.addEventListener('input', updateUniforms);

            dmm = document.querySelector('#dm-minval-input')
            dmm.addEventListener('input', updateUniforms);
            dmmx = document.querySelector('#dm-maxval-input')
            dmmx.addEventListener('input', updateUniforms);

            sm = document.querySelector('#star-minval-input')
            sm.addEventListener('input', updateUniforms);
            smx = document.querySelector('#star-maxval-input')
            smx.addEventListener('input', updateUniforms);

            bm = document.querySelector('#bh-minval-input')
            bm.addEventListener('input', updateUniforms);
            bmx = document.querySelector('#bh-maxval-input')
            bmx.addEventListener('input', updateUniforms);


        })
    })
}
function loadAttribute(size,type,attr,resolution_bool){
    /**
     * * loadAttribute() is called when selecting an attribute from one of the dropdown menus
     * 
     * size: number of voxels along each edge
     * type: particle type
     * attr: particle attribute
     * density: bool, whether density is loaded as a simultaneous texture
     * 
     * TODO: add error message if an invalid type is selected (velocity, group number, etc)
     * TODO: remove dat.GUI reliance, use custom container UI instead
     * TODO: scale volume rendering to match domain_left_edge and domain_right_edge
     */
    
     //load the desired dataset
    d3.json('static/data/'+simID+'/'+type+'/' + size + '_' + type + '_' + attr +'.json').then(function(d){
        if(type == 'PartType0') clearLayer(0);
        if(type == 'PartType1') clearLayer(1)
        if(type == 'PartType4') clearLayer(3)
        if(type == 'PartType5') clearLayer(4)
        // cleardThree(scene) //clears the THREE.js scene to prevent memory overload
        // if(gui){ //reset the dat.GUI
        //     gui.destroy()
        // }
        //set camera position so the entire dataset is in view
        // camera.position.set(size*1.5, size*1.5, size*1.5)
        // camera.lookAt(size/2,  size/2,  size/2)
        // camera.zoom = 6
        // camera.updateProjectionMatrix()
        // controls.target.set( size/2,  size/2,  size/2 );

        //arr holds the flattened data in Float32Array to be used as a 3D texture
        arr = new Float32Array(size * size * size)

        let log
        if(elements.includes(attr)){
            log = false
        }
        else{
            log = true
        }    
        
        // log = true
        //fill arr array with loaded data
        for(x=0;x<size;x++){
            for(y=0;y<size;y++){
                for(z=0;z<size;z++){
                    if(log){
                        arr[ x + y * size + z * size * size ] =  Math.log10(d[x][y][z])
                    }
                    else{
                        arr[ x + y * size + z * size * size ] =  d[x][y][z]
                    }
                }
            }
        }
        // console.log(arr)
        d = [] //clear loaded data since it is no longer needed
        
        
        //find the min and max values in the dataset and set the values in the container GUI input boxes
        var max = arr.reduce(function(a, b) {
            return Math.max(a, b);
        });
        var min = arr.reduce(function(a, b) {
            return Math.min(a, b);
        });
        console.log(min)
        if(min==-Infinity){min = -999999999999}
        setMinMaxInputValues(type,min,max)

        function setMinMaxInputValues(type,min,max){
            if(type=="PartType0"){
                var x = document.getElementById("gas-eye-open");
                x.style.display = "inline-block";
                var y = document.getElementById("gas-eye-closed");
                y.style.display = "none";
                if(resolution_bool && localStorage.getItem('gasMinVal') != ""){
                    min = localStorage.getItem('gasMinVal')
                }
                if(resolution_bool && localStorage.getItem('gasMaxVal') != ""){
                    max = localStorage.getItem('gasMaxVal')
                }
                climGasLimits = [min, max]
                type = 'gas'
            }
            else if(type =="PartType1"){
                var x = document.getElementById("dm-eye-open");
                x.style.display = "inline-block";
                var y = document.getElementById("dm-eye-closed");
                y.style.display = "none";
                if(localStorage.getItem('dmMinVal') != ""){
                    min = localStorage.getItem('dmMinVal')
                }
                if(localStorage.getItem('dmMaxVal') != ""){
                    max = localStorage.getItem('dmMaxVal')
                }
                climDMLimits = [min, max]
                type = 'dm'
            }
            else if(type =="PartType4"){
                var x = document.getElementById("star-eye-open");
                x.style.display = "inline-block";
                var y = document.getElementById("star-eye-closed");
                y.style.display = "none";
                if(localStorage.getItem('starMinVal') != ""){
                    min = localStorage.getItem('starMinVal')
                }
                if(localStorage.getItem('starMaxVal') != ""){
                    max = localStorage.getItem('starMaxVal')
                }
                climStarLimits = [min, max]
                type = 'star'
            }
            else if(type =="PartType5"){
                climDMLimits = [min, max]
                type = 'bh'
            }
            // type = 'gas'
            let minval = document.getElementById(type+'-minval-input')
            minval.value = round(min,2)
            let maxval = document.getElementById(type+'-maxval-input')
            maxval.value = round(max,2)
        }
    
        

        // The gui for interaction
        // gui = new dat.GUI()
        volconfig = { clim1: min, clim2: max, renderstyle: 'mip', isothreshold: max, colormap: 'viridis' };
        // gui.add( volconfig, 'clim1', min, max, 0.00001 ).onChange( updateUniforms );
        // gui.add( volconfig, 'clim2', min, max, 0.00001 ).onChange( updateUniforms );


        gm = document.querySelector('#gas-minval-input')
        gm.addEventListener('input', updateUniforms);
        gmx = document.querySelector('#gas-maxval-input')
        gmx.addEventListener('input', updateUniforms);

        dmm = document.querySelector('#dm-minval-input')
        dmm.addEventListener('input', updateUniforms);
        dmmx = document.querySelector('#dm-maxval-input')
        dmmx.addEventListener('input', updateUniforms);

        sm = document.querySelector('#star-minval-input')
        sm.addEventListener('input', updateUniforms);
        smx = document.querySelector('#star-maxval-input')
        smx.addEventListener('input', updateUniforms);

        bm = document.querySelector('#bh-minval-input')
        bm.addEventListener('input', updateUniforms);
        bmx = document.querySelector('#bh-maxval-input')
        bmx.addEventListener('input', updateUniforms);

        // gui.add( volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms );
        // gui.add( volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms );
        // gui.add( volconfig, 'isothreshold', min, max, 0.01 ).onChange( updateUniforms );
        
        //create texure from the data arr and select volume shader
        // var dens = loadDensity(128,'PartType0','DensityCGS')
        // console.log(dens)

        // densityTexture = dens[0]
        // densityMin = dens[1]
        // densityMax = dens[2]
        // dens = []
        var texture = new THREE.DataTexture3D( arr, size, size, size)
        texture.format = THREE.RedFormat
        texture.type = THREE.FloatType
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.unpackAlignment = 1
        var shader = THREE.VolumeRenderShader1;
        var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

        arr = []

        // cmtextures = {
        //     gray: new THREE.TextureLoader().load( 'static/textures/cm_gray.png', render ),
        //     viridis: new THREE.TextureLoader().load( 'static/textures/cm_viridis.png', render )
        // };
        initColor(type)
    
        // Material
        // if(density_bool){
        //     uniforms[ "u_densityDepthMod" ].value = 1.0;
        //     uniforms[ "u_density" ].value = densityTexture;
        //     uniforms[ "u_climDensity" ].value.set( densityMin, densityMax );
        // }
        // else{
        //     d = new Float32Array(size * size * size)
        //     for(x=0;x<size;x++){
        //         for(y=0;y<size;y++){
        //             for(z=0;z<size;z++){
        //                 arr[ x + y * size + z * size * size ] = 1.0
        //             }
        //         }
        //     }
        //     // console.log(d)
        //     densityTexture = new THREE.DataTexture3D( d, size, size, size)
        //     densityTexture.format = THREE.RedFormat
        //     densityTexture.type = THREE.FloatType
        //     densityTexture.minFilter = densityTexture.magFilter = THREE.LinearFilter
        //     densityTexture.unpackAlignment = 1
        //     uniforms[ "u_densityDepthMod" ].value = 0.0;
        //     uniforms[ "u_density" ].value = densityTexture;
        //     uniforms[ "u_climDensity" ].value.set( 1.0, 1.0 );
        //     d = []

        // }

        uniforms[ "u_data" ].value = texture;
        uniforms[ "u_size" ].value.set( size, size, size );
        uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
        uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        uniforms[ "u_cmdata" ].value = cmtexture;
        uniforms[ "u_clip" ].value = [false, false]
        
        var material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            clipping: true,
            side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
            transparent: true,
            opacity: 0.05,
            // blending: THREE.CustomBlending,
            blendSrc: THREE.OneMinusDstAlphaFactor,
            blendDst: THREE.OneFactor,
            depthWrite: false,
        } );

        // THREE.Mesh
        var geometry = new THREE.BoxGeometry( size, size, size );
        geometry.translate( size / 2, size / 2, size / 2 );

        createSkewerCube(size)

        var mesh = new THREE.Mesh( geometry, material );
        if(type == 'PartType0'){
            mesh.layers.set(0)
            mesh.renderOrder = 1
            gasMaterial = material
            gasMesh = mesh
            // console.log(gasMesh)
        }
        else if(type == 'PartType1'){
            mesh.layers.set(1)
            mesh.renderOrder = 0
            dmMaterial = material
            dmMesh = mesh
        }
        else if(type == 'PartType4'){
            mesh.layers.set(2)
            mesh.renderOrder = 2
            starMaterial = material
            starMesh = mesh
        }
        else if(type == 'PartType5'){
            mesh.layers.set(3)
            bhMaterial = material
            bhMesh = mesh
        }
        updateUniforms()
        scene.add( mesh );

        // changeValue()

        // render();
    });
}
function initColor(type){

    w = 256
    h = 1
    size = w * h
    data = new Uint8Array(3 * size)
    for(i=0;i<w;i++){
        stride = i * 3
        a = i/w
        if(type == 'PartType0') c = gasMinCol.clone().lerp(gasMaxCol,a)
        if(type == 'PartType1') c = dmMinCol.clone().lerp(dmMaxCol,a)
        if(type == 'PartType4') c = starMinCol.clone().lerp(starMaxCol,a)
        if(type == 'PartType5') c = bhMinCol.clone().lerp(bhMaxCol,a)
        // console.log(c)
        // console.log(c.r,c.g,c.b)
        data[stride] = Math.floor(c.r*255)
        data[stride+1] = Math.floor(c.g*255)
        data[stride+2] = Math.floor(c.b*255)
    }
    cmtexture[type] = new THREE.DataTexture(data,w,h,THREE.RGBFormat)

}
function changeColor(){
    /**
     * * changeColor() is called whe the value in a color selection box is changed and updates corresponding material uniforms
     */
    
    gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
    gasMidCol = new THREE.Color(document.querySelector("#gasMidCol").value);
    gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
    dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
    dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
    bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
    bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

    // dmCol = new THREE.Color(document.querySelector("#dmCol").value);
    dmMinCol = new THREE.Color(document.querySelector("#dmMinCol").value);
    dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
    // starCol = new THREE.Color(document.querySelector("#starCol").value);
    starMinCol = new THREE.Color(document.querySelector("#starMinCol").value);
    starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);
    bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
    bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

    col = document.getElementById('gas-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + gasMinCol.getHexString() +', #' + gasMidCol.getHexString() + ', #' + gasMaxCol.getHexString() + ')'
    col = document.getElementById('dm-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + dmMinCol.getHexString() +', #' + dmMaxCol.getHexString() + ')'
    col = document.getElementById('star-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + starMinCol.getHexString() +', #' + starMaxCol.getHexString() + ')'
    col = document.getElementById('bh-colorscale')
    col.style.background = 'linear-gradient( 0.25turn, #' + bhMinCol.getHexString() +', #' + bhMaxCol.getHexString() + ')'
    
    document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
    document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value
    document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value
    document.querySelector("#dmMinCol").style.backgroundColor = document.querySelector("#dmMinCol").value
    document.querySelector("#dmMaxCol").style.backgroundColor = document.querySelector("#dmMaxCol").value
    document.querySelector("#starMinCol").style.backgroundColor = document.querySelector("#starMinCol").value
    document.querySelector("#starMaxCol").style.backgroundColor = document.querySelector("#starMaxCol").value
    document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value
    document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value


    // materialGas.uniforms.minCol.value = new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0);
    // materialGas.uniforms.maxCol.value = new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0);
    // materialDarkMatter.uniforms.Col.value = new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0);
    // materialDarkMatter.uniforms.minCol.value = new THREE.Vector4(dmMinCol.r,dmMinCol.g,dmMinCol.b,1.0);
    // materialDarkMatter.uniforms.maxCol.value = new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0);
    
    // materialStar.uniforms.Col.value = new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0);
    // // materialStar.uniforms.maxCol.value = new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0);
    // materialBlackHole.uniforms.minCol.value = new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0);
    // materialBlackHole.uniforms.maxCol.value = new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0);

    localStorage.setItem('gasMinCol', "#" + gasMinCol.getHexString());
    localStorage.setItem('gasMidCol', "#" + gasMidCol.getHexString());
    localStorage.setItem('gasMaxCol', "#" + gasMaxCol.getHexString());
    
    // localStorage.setItem('dmCol', "#" + dmCol.getHexString());
    localStorage.setItem('dmMinCol', "#" + dmMinCol.getHexString());
    localStorage.setItem('dmMaxCol', "#" + dmMaxCol.getHexString());
    
    localStorage.setItem('starMinCol', "#" + starMinCol.getHexString());
    localStorage.setItem('starMaxCol', "#" + starMaxCol.getHexString());

    localStorage.setItem('bhMinCol', "#" + bhMinCol.getHexString());
    localStorage.setItem('bhMaxCol', "#" + bhMaxCol.getHexString());

    if(material || gasMaterial || dmMaterial || starMaterial || bhMaterial || volMaterial){
        updateUniforms()
    }

}

function createSkewerCube(size){
    /**
     * * createSkewerCube() creates an invisible cube that is scaled to the extents of the domain of the data
     * * this is used for using a raycaster when placing skewers
     * size = voxels per edge
     */
    
    var geometry = new THREE.BoxBufferGeometry( size,size,size );
    var material = new THREE.MeshBasicMaterial( {color: 0xffffff, wireframe: true, transparent: true, opacity: 0.0} );
    material.depthWrite = false;
    cube = new THREE.Mesh( geometry, material );
    cube.position.set(size/2, size/2, size/2);
    scene.add( cube );

    edges_scaled = {
        'left_edge' : [0,0,0],
        'right_edge' : [size,size,size]
    }
}

function loadData(){
    
    // Load Volume Rendering Data
    d3.json('static/data/temp.json').then(function(d){
        
        size = 128
        arr = new Float32Array(size * size * size)
        
        for(x=0;x<size;x++){
            for(y=0;y<size;y++){
                for(z=0;z<size;z++){
                    arr[ x + y * size + z * size * size ] = d[x][y][z]
                }
            }
        }

        var max = arr.reduce(function(a, b) {
            return Math.max(a, b);
        });

        // console.log(max)
        
        // console.log(arr)
        function updateUniforms() {

			material.uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
			material.uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
			material.uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
            material.uniforms[ "u_cmdata" ].value = cmtexture;

			// render();

		}
        gui = new dat.GUI()

        // The gui for interaction
        volconfig = { clim1: 0, clim2: 300000, renderstyle: 'mip', isothreshold: 700, colormap: 'viridis' };
        gui.add( volconfig, 'clim1', 0, 300000, 0.00001 ).onChange( updateUniforms );
        gui.add( volconfig, 'clim2', 0, 300000, 0.00001 ).onChange( updateUniforms );
        gui.add( volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms );
        gui.add( volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms );
        gui.add( volconfig, 'isothreshold', 0, 30000, 0.01 ).onChange( updateUniforms );
        
        var texture = new THREE.DataTexture3D( arr, size, size, size)
        texture.format = THREE.RedFormat
        texture.type = THREE.FloatType
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.unpackAlignment = 1
        var shader = THREE.VolumeRenderShader1;
        var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

        arr = []


        cmtextures = {
            gray: new THREE.TextureLoader().load( 'static/textures/cm_gray.png', render ),
            viridis: new THREE.TextureLoader().load( 'static/textures/cm_viridis.png', render )

        };

    
        // Material

        uniforms[ "u_data" ].value = texture;
        uniforms[ "u_size" ].value.set( size, size, size );
        uniforms[ "u_clim" ].value.set( volconfig.clim1, volconfig.clim2 );
        uniforms[ "u_renderstyle" ].value = volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
        uniforms[ "u_renderthreshold" ].value = volconfig.isothreshold; // For ISO renderstyle
        uniforms[ "u_cmdata" ].value = cmtextures[ volconfig.colormap ];
        
        // uniforms[ "u_clim" ].value.set( 0 , 1000 );
        // uniforms[ "u_renderstyle" ].value = 0; // 0: MIP, 1: ISO
        // uniforms[ "u_renderthreshold" ].value = 900; // For ISO renderstyle
        // uniforms[ "u_cmdata" ].value = cmtextures.viridis;

        material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            clipping: false,
            side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
            transparent: true,
        } );

        // THREE.Mesh
        var geometry = new THREE.BoxGeometry( size, size, size );
        camera.position.set(size*2, size*2, size*2)
        camera.lookAt(size/2,  size/2,  size/2)
        camera.updateProjectionMatrix()
        controls.target.set( size/2,  size/2,  size/2 );
        geometry.translate( size / 2, size / 2, size / 2 );
        

        var mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );

        updateUniforms()

        // render();

    })
    
}

function animate() {
    /**
     * * animate()
     */
        
    // requestAnimationFrame( animate )      
}

function render() {
    /**
     * * render()
     */

    requestAnimationFrame( render );
    controls.update()

    let divGrid = (document.getElementById("grid-check")).checked
    let divGridRadio1 = (document.getElementById("grid-radio-1")).checked
    if(divGrid && divGridRadio1){
        let vector = new THREE.Vector3()
        dir = camera.getWorldDirection(vector)
        // console.log(vector)
        // theta = Math.atan2(vector.x,vector.z)
        staticGrid.lookAt(camera.position.x,camera.position.y,camera.position.z)
        staticGrid.rotateX(Math.PI/2)
    }
    renderer.render( scene, camera );   
};

function round(value, decimals) {
    /**
     * * round() to a certain number of decimals 
     */
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}
function setTwoNumberDecimal(el) {
    // el.value = el.value.toFixed(2);
};

// function refreshLoop() {
//     /*
//      * * refreshLoop() finds the frame rate 
//      */
//     window.requestAnimationFrame(() => {
//         const now = performance.now();
//         while (times.length > 0 && times[0] <= now - 1000) {
//         times.shift();
//         }
//         times.push(now);
//         fps = times.length;
//         refreshLoop();
//     });
// }

function toggleDrawSkewerMode(){
    /*
     * * toggleDrawSkewerMode() turns the visibility of placed skewers on and off 
     */
    drawSkewers = !drawSkewers
    if(drawSkewers){
        document.getElementById('skewer-laser').style.filter = 'invert(98%) sepia(0%) saturate(51%) hue-rotate(144deg) brightness(117%) contrast(100%)'
    }
    else{
        document.getElementById('skewer-laser').style.filter = ''
    }
}

function toggleValueThreshold(type,e){
    /*
     * * toggleValueThreshold() enforces the 'min' or 'max' checkbox state for controlling the color scale value
     * example: unchecked (default) users can change the value in the number input below. when checked, returns the value to the min or max
     type = particle type. 'gas' or 'bh'
     e = 'min' or 'max' checkbox

     TODO: Hook this up to the volume rendering
     */

    if(type == 'gas' && e == 'min'){
        document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
        if(document.getElementById("gas-min-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType0'
            attr = document.getElementById('gas_select').value
            findMinMax(type,attr,e)
        }
        else{
            // materialGas.uniforms.min.value = document.getElementById('gas-minval-input').value
            gasMaterial.uniforms[ "u_clim" ].value.set( document.querySelector('#gas-minval-input').value, document.querySelector('#gas-maxval-input').value );
            // gasMaterial.uniforms.min.value = document.getElementById('gas-minval-input').value

        }
    }
    if(type == 'gas' && e == 'max'){
        document.getElementById("gas-maxval-input").disabled = (document.getElementById("gas-max-check").checked);
        // materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        if(document.getElementById("gas-max-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType0'
            attr = document.getElementById('gas_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        }
    }
    if(type == 'bh' && e == 'min'){
        document.getElementById("bh-minval-input").disabled = (document.getElementById("bh-min-check").checked);
        // materialGas.uniforms.min.value = document.getElementById('gas-minval-input').value
        if(document.getElementById("bh-min-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType5'
            attr = document.getElementById('bh_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialBlackHole.uniforms.min.value = document.getElementById('bh-minval-input').value
        }
    }
    if(type == 'bh' && e == 'max'){
        document.getElementById("bh-maxval-input").disabled = (document.getElementById("bh-max-check").checked);
        // materialGas.uniforms.max.value = document.getElementById('gas-maxval-input').value
        if(document.getElementById("bh-max-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType5'
            attr = document.getElementById('bh_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialBlackHole.uniforms.max.value = document.getElementById('bh-maxval-input').value
        }
    }

    function findMinMax(type,attr,e){
        let min, max
        for( i=0; i<particles.length; i++ ){
            if(particles[i].particle_type == type && particles[i].attribute == attr){
                min = particles[i].min
                max = particles[i].max
            }
        }
        if( type == 'PartType0' ){
            if ( e == 'min' ){
                materialGas.uniforms.min.value = min
            }
            if ( e == 'max'){
                materialGas.uniforms.max.value = max
            }
        }
        if( type == 'PartType5' ){
            if ( e == 'min' ){
                materialBlackHole.uniforms.min.value = min
            }
            if ( e == 'max' ){
                materialBlackHole.uniforms.max.value = max
            }
        }
    }   
}

function clipPoints(type, e){
    /*
     * * clipPoints() hides particles above and below the value thresholds 
     !? can this work with the volume renderer? does it make sense?
     */

    minClip = document.getElementById(type + "-min-clip-check").checked
    maxClip = document.getElementById(type + "-max-clip-check").checked
    if( type == 'gas' ){
        if ( e == 'min' ){
            materialGas.uniforms.minClip.value = minClip
        }
        if ( e == 'max'){
            materialGas.uniforms.maxClip.value = maxClip
        }
    }
    if( type == 'bh' ){
        if ( e == 'min' ){
            materialBlackHole.uniforms.minClip.value = minClip
        }
        if ( e == 'max' ){
            materialBlackHole.uniforms.maxClip.value = maxClip
        }
    }
}

// function changeValue(){
//     /**
//     * * changeValue() is called when a user updates a number input value
//     * 
//     * TODO: fix this for volume renderer
//     */

//     // create event listeners
//     gm = document.querySelector('#gas-minval-input')
//     gm.addEventListener('input', updateUniforms());
    
//     gmx = document.querySelector('#gas-maxval-input')
//     gmx.addEventListener('input', updateUniforms());

//     bhm = document.querySelector('#bh-minval-input')
//     bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
    
//     bhmx = document.querySelector('#bh-maxval-input')
//     bhmx.addEventListener('input',changeVal('bh','max', document.getElementById('bh-maxval-input').value),true);
    
//     function changeVal(type,e,val){
//         console.log('change val')
//         if(type == 'gas' && e == 'min'){
//             materialGas.uniforms.min.value = val
//         }
//         if(type == 'gas' && e == 'max'){
//             materialGas.uniforms.max.value = val
//         } 
//         if(type == 'bh' && e == 'min'){
//             materialBlackHole.uniforms.min.value = val
//         }
//         if(type == 'bh' && e == 'max'){
//             materialBlackHole.uniforms.max.value = val
//         }            
//     }
// }

function updateUnits(type,units){
    /**
     * * updateUnits() Updates the units displayed underneath the number input box
     * TODO: get the units for the volume renderer
     */
    if (type == 'PartType0'){
        gas_units = document.getElementsByClassName('gas-attr-units')
        for(i=0;i<gas_units.length;i++){
            gas_units[i].textContent = units
        }
    }
    if (type == 'PartType5'){
        bh_units = document.getElementsByClassName('bh-attr-units')
        for(i=0;i<bh_units.length;i++){
            bh_units[i].textContent = units
        }
    }
}

// check to see if the mouse is over a container. This is used when drawing skewers
$(".container").hover(function(){
    container_hover = true;
    }, function(){
    container_hover = false;
});



function deleteLine(idx){
    /**
     * * deleteLine() removes a skewer from the scene
     */
    let del = document.getElementById('skewer-coords-' + idx + '')
    del.remove()
    // let stat = document.getElementById('spectra-status-skewer-coords-' + idx + '')
    // stat.remove()
    scene.remove(lines[idx])
}

function retryLine(idx){
    /**
     * * retryLine() requests another spectrum if the first one did not compute
     */

    requestSpectrum(idx)
}

function requestSpectrum(idx){
    /**
     * * requestSpectrum() prepares and sends the coordinates of a skewer to the python backend for processing 
     * ? pt values are scaled since the voxelization process distorts the physical distances
     */
    
    pt1 = scalePointCoords(skewers[idx].point1)
    pt2 = scalePointCoords(skewers[idx].point2)
    
    buttonId = 'request-button-' + idx + ''
    div = document.getElementById(buttonId)
    div.disabled = true
    sendLine(idx,pt1,pt2)
    div.innerText = 'requesting spectrum . . . '

    function scalePointCoords(pt){
        x_scale = (edges_scaled.right_edge[0]-edges_scaled.left_edge[0])/(edges.right_edge[0] - edges.left_edge[0])
        y_scale = (edges_scaled.right_edge[1]-edges_scaled.left_edge[1])/(edges.right_edge[1] - edges.left_edge[1])
        z_scale = (edges_scaled.right_edge[2]-edges_scaled.left_edge[2])/(edges.right_edge[2] - edges.left_edge[2])
        pt.x = pt.x/x_scale
        pt.y = pt.y/y_scale
        pt.z = pt.z/z_scale
        return pt
    }

    function sendLine(idx,point1,point2){
        // socket.emit('selectRay',skewers.length-1, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
        socket.emit('selectRay',simID,idx, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
    }
}


function plotSyntheticSpectrum(points) {
    /**
     * * plotSyntheticSpectrum() generates a new plot for the data it has received
     */

    // skewerData.push(points)
    data = []
    var margin = {top: 10, right: 30, bottom: 30, left: 30},
        width = 300 - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;
    for(i=0;i<points.lambda.length;i++){
        data[i] = { 'lambda': points.lambda[i], 'flux': points.flux[i] }
    }
    
    skewers[points.index] = ({'point1': {'x': points.start[0],'y': points.start[1],'z': points.start[2]}, 'point2':{'x': points.end[0],'y': points.end[1],'z': points.end[2]}, 'lambda': points.lambda, 'flux': points.flux })
    skewerData.push([points,data])
    
    
    // console.log(data)
    domainLambda = d3.extent(points.lambda)
    
    // console.log(domainLambda)
    xScale = d3.scaleLinear()
                .range([0, width + margin.left + margin.right])
                .domain(domainLambda);
                
    
    updateGraph()
    createBrush()
}

/**
 * * GRAPH PLOTTING
 */

function updateGraph(){
    var margin = {top: 10, right: 30, bottom: 30, left: 50},
    width = 300 - margin.left - margin.right,
    height = 200 - margin.top - margin.bottom;


    let ele = document.getElementsByName('x-axis-transform')
    for(i = 0; i < ele.length; i++) { 
        if(ele[i].checked) {
            ele = ele[i].value
        }
    }
    
    d3.select("#spectrum").selectAll(".graph").remove()

    if(skewerData.length){
        // console.log(skewerData.length)
        for(i=0;i<skewerData.length;i++){   
            // console.log(i)
            let data = []
            let idx = skewerData[i][0].index
            // console.log(idx)
            x = Array.from(skewers[idx].lambda)
            y = Array.from(skewers[idx].flux)

            if(ele == "Angstroms" && document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)"){
                // domainLambda = d3.extent(x)

                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': y[j] }
                }
            }
            else if(ele == "Velocity Space" && document.getElementById("common-wavelengths").value != "Select a rest wavelength (Å)"){
                let rest_lambda = parseFloat(document.getElementById("common-wavelengths").value)
                let c = 3e5;
                for( j = 0; j < x.length; j++ ){
                    delta_lambda = x[j] - rest_lambda;
                    x[j] = ( c * delta_lambda ) / rest_lambda;
                }
                // domainLambda = d3.extent(x)
                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                }
            }
            else{
                for(j=0;j<x.length;j++){
                    data[j] = { 'lambda': x[j], 'flux': skewers[idx].flux[j] }
                }
            }

            // console.log("plotted " + idx)

            var svg = d3.select("#spectrum")
                .append("svg")
                .attr("class","graph")
                .attr("id","graph-" + idx + '')
                .attr("width", width + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.append("defs").append("clipPath")
                .attr("id", "clip")
                .append("rect")
                .attr("width", width)
                .attr("height", height);
            // xScale = d3.scaleLinear()
            //     .range([0, width])
            //     .domain(d3.extent(skewerData[i].lambda));
            svg.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(xScale).ticks(6));
           
            // text label for the x axis
            svg.append("text")             
                .attr("transform", "translate(" + (width/2) + " ," + (height + margin.top + 30) + ")")
                .style("text-anchor", "middle")
                .text("λ")
            
            var yScale = d3.scaleLinear()
                .range([height, 0])
                .domain(d3.extent(skewers[idx].flux));
            svg.append("g")
                .call(d3.axisLeft(yScale));
            
            // text label for the y axis
            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - margin.left)
                .attr("x", 0 - (height / 2))
                .attr("dy", "0.9em")
                .style("text-anchor", "middle")
                .text("flux");

            var line = d3.line()
                .x(d => xScale(d.lambda))
                .y(d => yScale(d.flux))      

            svg.append("path")
                .datum(data)
                .attr("class", "line")
                .attr("d", line)

            svg.append("text")
                .attr("transform", "translate(-40,10)")
                .text(idx)
            
            
            if(lines[idx]){
                let id = "#graph-" + idx + ''
                $(id).hover(function(){
                    
                    lines[idx].material.color = new THREE.Color(0,1,0)
                    }, function(){
                        lines[idx].material.color = new THREE.Color(0xff5522)
                });
            }
        }
    }
}

function createXYZBrush(xyz){
    // https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
    // d3.select('#terminal').selectAll('.depth-brush').remove();
    
    d3.select('#terminal').append('div').attr('id',xyz+'-depth-brush-label').attr('class','depth-brush').append('text').text(xyz)
    let svg = d3.select('#terminal').append('div').attr('id',xyz+'-depth-brush').attr('class','depth-brush').append('svg')

    let margin = {top: 20, right: 15, bottom: 30, left: 20};
    let axis = svg.append('g');

    let brush = svg.append("g")
        .attr("class", "brush");

    let width = 300, height = 40
    var x = d3.scaleLinear()
        .domain([0.0,1.0])
        .range([margin.left, width]);

    var y = d3.scaleLinear()
        .domain([0.0,1.0])
        .range([margin.left, width]);

    var z = d3.scaleLinear()
        .domain([0.0,1.0])
        .range([margin.left, width]);


    XYZresize();
    drawXYZBrush(xyz);

    function XYZresize() {
        var w = width - margin.right;
        var h = 60;

        var aspect = w / h;
        var vw = width;
        var vh = vw / aspect;

        width = vw;
        height = vh - margin.bottom;

        svg
            //.style("font-size", "2px")
            .attr('width', w).attr('height', h)
            .attr("viewBox", "0 0 " + vw + " " + vh)
            //.attr("text", "white")

        x.range([margin.left, width - margin.right]);
        axis.attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x).ticks(6))

        y.range([margin.left, width - margin.right]);
        axis.attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(y).ticks(6))

        z.range([margin.left, width - margin.right]);
        axis.attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(z).ticks(6))

    }

    function drawXYZBrush(xyz) {
        // if (!x) { return; }
        if(xyz == 'x'){
            if (!x) { return; }
            brusher = d3.brushX()
                .extent([[margin.left, 0], [width - margin.right, height]])
                .on("brush end", XYZbrushed);
            brush.call(brusher)
                .call(brusher.move, x.range());
        }
        
        else if (xyz == 'y'){
            if (!y) { return; }
            brusher = d3.brushX()
                .extent([[margin.left, 0], [width - margin.right, height]])
                .on("brush end", XYZbrushed);
            brush.call(brusher)
                .call(brusher.move, y.range());
        }
        
        else if( xyz == 'z'){
            if (!z) { return; }
            brusher = d3.brushX()
                .extent([[margin.left, 0], [width - margin.right, height]])
                .on("brush end", XYZbrushed);
            brush.call(brusher)
                .call(brusher.move, z.range());
        }
    }

    function XYZbrushed() {

        if(xyz == 'x'){
            var s = d3.event.selection || x.range();
            ret = s.map(x.invert, x);
        }
        else if(xyz == 'y'){
            var s = d3.event.selection || y.range();
            ret = s.map(y.invert, y);
        }
        else if(xyz == 'z'){
            var s = d3.event.selection || z.range();
            ret = s.map(z.invert, z);
        }
        
        
        // console.log(s)
        // console.log(ret)

        if (ret[0] !== ret[1]) {
            updateXYZDomain(xyz,ret[0],ret[1])
        }
    }
}

function updateXYZDomain(xyz, min, max){
    if(xyz == 'x'){
        domainXYZ[0] = min
        domainXYZ[1] = max
    }
    else if(xyz == 'y'){
        domainXYZ[2] = min
        domainXYZ[3] = max
    }
    else if(xyz == 'z'){
        domainXYZ[4] = min
        domainXYZ[5] = max
    }

    updateUniforms();
    
    xSliderScale = d3.scaleLinear().domain([domainXYZ[0],domainXYZ[1]]).range([0, 210])
    ySliderScale = d3.scaleLinear().domain([domainXYZ[2],domainXYZ[3]]).range([0, 210])
    zSliderScale = d3.scaleLinear().domain([domainXYZ[4],domainXYZ[5]]).range([0, 210])
}

function createBrush() {
    // https://github.com/CreativeCodingLab/DynamicInfluenceNetworks/blob/master/src/js/focusSlider.js
    d3.select('#spectrum').selectAll('#depth-brush').remove();
    let svg = d3.select('#spectrum').append('div').attr('id','depth-brush').append('svg')

    let margin = {top: 10, right: 15, bottom: 30, left: 30};
    let axis = svg.append('g');

    let brush = svg.append("g")
        .attr("class", "brush");

    let width = 300, height = 40
    let x = d3.scaleLinear()
        .domain(domainLambda)
        .range([margin.left, width]);

    resize();
    drawBrush();
    brushed();

    function resize() {
        var w = width - margin.right;
        var h = 40;

        var aspect = w / h;
        var vw = width;
        var vh = vw / aspect;

        width = vw;
        height = vh - margin.bottom;

        svg
            //.style("font-size", "2px")
            .attr('width', w).attr('height', h)
            .attr("viewBox", "0 0 " + vw + " " + vh)
            //.attr("text", "white")

        x.range([margin.left, width - margin.right]);

        axis.attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x).ticks(6))

    }

    function drawBrush() {
        if (!x) { return; }
        brusher = d3.brushX()
            .extent([[margin.left, 0], [width - margin.right, height]])
            .on("brush end", brushed);

        brush.call(brusher)
            .call(brusher.move, x.range());
    }

    function brushed() {
        var s = d3.event.selection || x.range();
        ret = s.map(x.invert, x);
        // console.log(s)
        // console.log(ret)
        if (ret[0] !== ret[1]) {
            
            updateLambdaDomain(ret[0],ret[1])
            updateGraph()

        }
    }
}

function updateLambdaDomain(min, max){
    if(min != undefined){
        domainLambda[0] = min
    }
    if(max != undefined){
        domainLambda[1] = max
    }
    xScale = d3.scaleLinear().domain(domainLambda).range([0, 210])
}

function commonWavelength(){
    val = parseFloat(document.getElementById("common-wavelengths").value)
    let ele = document.getElementsByName('x-axis-transform')
    for(i = 0; i < ele.length; i++) { 
        if(ele[i].checked) {
            ele = ele[i].value
        }
    }
    if(ele == "Angstroms"){
        updateLambdaDomain(val-5,val+5)
        console.log(domainLambda)
    }
    else if(ele == "Velocity Space"){
        updateLambdaDomain(-2000,2000)
    }
    updateGraph()
    createBrush()
}

function downloadSpectra(){
    
    var c = skewerData[0][0].lambda.map(function(e, i) {
        return [e, skewerData[0][0].flux[i]];
      });

    c = JSON.stringify(c)

    name = 'spectra.txt'
    const a = document.createElement('a');
	const type = name.split(".").pop();
	a.href = URL.createObjectURL( new Blob([c], { type: type} )) ;
	a.download = name;
	a.click();
}

function checkSelectedSimID(){
    let selection = document.getElementById("sim_size_select")
    oldSimID = simID
    simID = selection.value
    
    if(oldSimID != simID){
        d3.json('static/data/'+simID+'/simMetadata.json').then(function(d){
            edges.left_edge = d.left_edge
            edges.right_edge = d.right_edge
            field_list = d.field_list
            createAttributeSelectors(field_list)
            simSize = (edges.right_edge[0]-edges.left_edge[0])/0.6776999078
            toggleGrid()

        })
        clearDropDowns()
                
        
        function clearDropDowns(){
            $("#gas_select").empty();
            $("#dm_select").empty();
            $("#star_select").empty();
            $("#bh_select").empty();
        }
    }

    // console.log(field_list);
    
    
    function createAttributeSelectors(field_list){
        var select = document.getElementById("gas_select"); 
        var option = document.createElement("option");
        option.disabled = "disabled"
        option.selected = "selected"
        option.text = "Select an attribute"
        select.add(option);

        var select = document.getElementById("bh_select"); 
        var option = document.createElement("option");
        option.disabled = "disabled"
        option.selected = "selected"
        option.text = "Select an attribute"
        select.add(option);

        for(i = 0; i < field_list.length; i++){
            if(field_list[i][0] == 'PartType0'){
                var select = document.getElementById("gas_select"); 
                var option = document.createElement("option");
                option.text = field_list[i][1];
                select.add(option);
            }
            // if(field_list[i][0] == 'PartType1'){
            //     var select = document.getElementById("dm_select"); 
            //     var option = document.createElement("option");
            //     option.text = field_list[i][1];
            //     select.add(option);
            // }
            // if(field_list[i][0] == 'PartType4'){
            //     var select = document.getElementById("star_select"); 
            //     var option = document.createElement("option");
            //     option.text = field_list[i][1];
            //     select.add(option);
            // }
            if(field_list[i][0] == 'PartType5'){
                var select = document.getElementById("bh_select");
                var option = document.createElement("option");
                option.text = field_list[i][1];
                select.add(option);
            }
        }
        // sendSimIDtoServer(simID)
        loadGasDMAttributes(64,'Temperature', false)
        
    }

    function sendSimIDtoServer(simID){
        socket.emit('simIDtoServer',simID)
    }
}

/**
 * * WAIT UNTIL PAGE IS LOADED
 */

$(document).ready(function(){


    $(".container").hover(function(){
        container_hover = true;
        }, function(){
        container_hover = false;
    });
    
    
    

    init()
    animate()
    render()
    asyncCall()
    
    
    function init(){

        checkSelectedSimID()
        THREE.Cache.enabled = true
        canvas = document.createElement('canvas')
        context = canvas.getContext('webgl2', { antialias: true, alpha: true })
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color("rgb(4,6,23)")

        camera = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 0.00001, 4000 );
        
        camera.layers.enable(0);
        camera.layers.enable(1);
        camera.layers.enable(2);
        camera.layers.enable(3);
        camera.layers.enable(4);
        camera.layers.enable(9);
        camera.layers.enable(10);

        // camera.layers.toggle(9)
        // var gridHelper = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper.position.set(0,-gridsize/2,0)
        // gridHelper.layers.set(9)
        // gridHelper.material.transparent = true;
        // gridHelper.material.alpha = 0.01;
        // gridHelper.translateX( gridsize / 2);
        // gridHelper.translateY( gridsize / 2);
        // gridHelper.translateZ( gridsize / 2);
        // gridHelper.side = THREE.DoubleSide
        // scene.add( gridHelper );

        // var gridHelper1 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper1.position.set(0,gridsize,-gridsize/2)
        // gridHelper1.rotateX(Math.PI/2)
        // gridHelper1.layers.set(9)
        // gridHelper1.material.transparent = true;
        // gridHelper1.material.alpha = 0.01;
        // gridHelper1.translateX( gridsize / 2);
        // gridHelper1.translateY( gridsize / 2);
        // gridHelper1.translateZ( gridsize / 2);
        // gridHelper1.side = THREE.DoubleSide
        // scene.add( gridHelper1 );

        // var gridHelper2 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper2.position.set(gridsize/2,0,0)
        // gridHelper2.rotateZ(Math.PI/2)
        // gridHelper2.layers.set(9)
        // gridHelper2.material.transparent = true;
        // gridHelper2.material.alpha = 0.01;
        // gridHelper2.translateX( gridsize / 2);
        // gridHelper2.translateY( gridsize / 2);
        // gridHelper2.translateZ( gridsize / 2);
        // gridHelper2.side = THREE.DoubleSide
        // scene.add( gridHelper2 );

        // var gridHelper3 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper3.position.set(0,gridsize/2,0)
        // gridHelper3.layers.set(9)
        // gridHelper3.material.transparent = true;
        // gridHelper3.material.alpha = 0.01;
        // gridHelper3.translateX( gridsize / 2);
        // gridHelper3.translateY( gridsize / 2);
        // gridHelper3.translateZ( gridsize / 2);
        // gridHelper3.side = THREE.DoubleSide
        // scene.add( gridHelper3 );

        // var gridHelper4 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper4.position.set(0,gridsize,gridsize/2)
        // gridHelper4.rotateX(Math.PI/2)
        // gridHelper4.layers.set(9)
        // gridHelper4.material.transparent = true;
        // gridHelper4.material.alpha = 0.01;
        // gridHelper4.translateX( gridsize / 2);
        // gridHelper4.translateY( gridsize / 2);
        // gridHelper4.translateZ( gridsize / 2);
        // gridHelper4.side = THREE.DoubleSide
        // scene.add( gridHelper4 );

        // var gridHelper5 = new THREE.GridHelper( gridsize, divisions, new THREE.Color( 0x222222 ), new THREE.Color( 0x444444 ) );
        // gridHelper5.position.set(1.5*gridsize,0,0)
        // gridHelper5.rotateZ(Math.PI/2)
        // gridHelper5.layers.set(9)
        // gridHelper5.material.transparent = true;
        // gridHelper5.material.alpha = 0.01;
        // gridHelper5.translateX( gridsize / 2);
        // gridHelper5.translateY( gridsize / 2);
        // gridHelper5.translateZ( gridsize / 2);
        // gridHelper5.side = THREE.DoubleSide
        // scene.add( gridHelper5 );

        

        

        renderer = new THREE.WebGLRenderer( { canvas: canvas, context: context });
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.antialias = true;
        renderer.precision = 'highp';
        renderer.powerPreference = 'high-performance'
        renderer.sortPoints = true;
        renderer.gammaFactor = 2.2;
        renderer.gammaOutput = true;
        renderer.logarithmicDepthBuffer = false
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);

        // camera.position.set(8.47, 8.47, 8.47)
        camera.position.set(gridsize*2, gridsize*2, gridsize*2)
        camera.lookAt(gridsize/2,  gridsize/2,  gridsize/2)
        camera.zoom = 6
        // camera.lookAt(0,0,0)
        camera.updateProjectionMatrix();

        
        // edges.right_edge[0]-edges.left_edge[0], edges.right_edge[1]-edges.left_edge[1], edges.right_edge[2]-edges.left_edge[2]
        // controls.target.set( 8.47/2, 8.47/2, 8.47/2 );

        controls.target.set( gridsize/2, gridsize/2, gridsize/2 );

        controls.update()

        controls.enableDamping = true
        controls.dampingFactor = 0.14;

        // initMaterial();
        initColor();
        
        document.body.appendChild( renderer.domElement );
        document.addEventListener('keydown', onKeyDown, false)
        window.addEventListener( 'resize', onWindowResize, false );
        document.addEventListener( 'mousemove', onMouseMove, false );

        document.addEventListener( 'click', onMouseClick, false );
        document.addEventListener( 'wheel', onMouseWheel, false );


        // changeValue()
        // gm = document.querySelector('#gas-minval-input')
        // gm.addEventListener('input', changeVal('gas','min',document.getElementById('gas-minval-input').value),true);
        
        // gmx = document.querySelector('#gas-maxval-input')
        // gmx.addEventListener('input',changeVal('gas','min', document.getElementById('gas-maxval-input').value),true);
        
        // bhm = document.querySelector('#bh-minval-input')
        // bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
        
        // bhmx = document.querySelector('#bh-maxval-input')
        // bhmx.addEventListener('input',changeVal('bh','min', document.getElementById('bh-maxval-input').value),true);
        

        // function changeVal(type,e,val){
        //     if(type == 'gas' && e == 'min'){
        //         materialGas.uniforms.min.value = val
        //     }
        //     if(type == 'gas' && e == 'max'){
        //         materialGas.uniforms.max.value = val
        //     }   
        //     if(type == 'bh' && e == 'min'){
        //         materialBlackHole.uniforms.min.value = val
        //     }
        //     if(type == 'bh' && e == 'max'){
        //         materialBlackHole.uniforms.max.value = val
        //     }          
        // }

        gmc = document.querySelector("#gasMinCol")
        gmc.addEventListener('change',changeColor,false);
        gmd = document.querySelector("#gasMidCol")
        gmd.addEventListener('change',changeColor,false);
        gmxc = document.querySelector("#gasMaxCol")
        gmxc.addEventListener('change',changeColor,false);
        
        dmc = document.querySelector("#dmMinCol")
        dmc.addEventListener('change',changeColor,false);
        dmxc = document.querySelector("#dmMaxCol")
        dmxc.addEventListener('change',changeColor,false);

        // smc = document.querySelector("#starCol")
        // smc.addEventListener('change',changeColor,false);
        smc = document.querySelector("#starMinCol")
        smc.addEventListener('change',changeColor,false);
        smxc = document.querySelector("#starMaxCol")
        smxc.addEventListener('change',changeColor,false);

        bmc = document.querySelector("#bhMinCol")
        bmc.addEventListener('change',changeColor,false);
        bmxc = document.querySelector("#bhMaxCol")
        bmxc.addEventListener('change',changeColor,false);

        createXYZBrush('x')
        createXYZBrush('y')
        createXYZBrush('z')

        // refreshLoop();

        toggleGrid()

        camPos = camera.position

        
        // loadData()
    }
    
    function onMouseMove( event ) {
        /**
         * * onMouseMove() is an event listener for when the mouse position changes
         */
        mouse.x = ( event.clientX - windowHalf.x );
        mouse.y = ( event.clientY - windowHalf.x );
        
    }
    function onMouseClick( event ) {
        /**
         * * onMouseClick() is an event listener for when the mouse is clicked. Mainly used for drawing skewers
         */
        
        //get mouse coordinates in screen space
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        //find start and end points on mouse click when drawSkewers is true
        if(drawSkewers && !container_hover){


            //this uses the position of the camera and the location of the mouse press
            //in order to generate a point in the space that passes from the camera through the mouse position
            planeNormal.copy(camera.position).normalize();
            plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, point);
            var geometry = new THREE.Geometry();
            ray1 = new THREE.Vector3(point.x,point.y,point.z)
            cd = new THREE.Vector3()
            camera.getWorldDirection(cd)
            
            //check to see if the mouse click intersects with invisible cube around the data
            if(raycaster.intersectObject(cube).length>0){
                //runs algorithm that finds two end points on surface of the cube
                findLineEnds(ray1,cd)    
            }
            
            function findLineEnds(ray,dir){
                /**
                 * * findLineEnds() gets the start and end points of a line drawn at the intersection between the mouse position and near and far sides of the cube
                 */

                //checks to see if the selected point is inside or outside of the domain of the data
                //in order to determine direction to move the points. incrementally moves the point
                //in the camera direction at a size delta until it reaches the boundary
                if(checkIfInside(ray)){
                    let point1 = ray.clone()
                    let point2 = ray.clone()
                    delta = 0.01

                    console.log('true')
                    

                    while(  (point1.x >= edges_scaled.left_edge[0] && point1.x <= edges_scaled.right_edge[0]) &&
                            (point1.y >= edges_scaled.left_edge[1] && point1.y <= edges_scaled.right_edge[1]) &&
                            (point1.z >= edges_scaled.left_edge[2] && point1.z <= edges_scaled.right_edge[2])){
                                
                                point1.x += delta*dir.x
                                point1.y += delta*dir.y
                                point1.z += delta*dir.z
                                
                    }
                    while(  (point2.x >= edges_scaled.left_edge[0] && point2.x <= edges_scaled.right_edge[0]) &&
                            (point2.y >= edges_scaled.left_edge[1] && point2.y <= edges_scaled.right_edge[1]) &&
                            (point2.z >= edges_scaled.left_edge[2] && point2.z <= edges_scaled.right_edge[2])){
                                
                                point2.x -= delta*dir.x
                                point2.y -= delta*dir.y
                                point2.z -= delta*dir.z
                    }
                    
                    printLine(point1,point2)
                }
                else{
                    console.log('false')
                    let point1 = ray.clone()
                    console.log(point1)
                    console.log(dir)
                    delta = 0.01
                    
                    while(  (point1.x <= edges_scaled.left_edge[0] || point1.x >= edges_scaled.right_edge[0]) ||
                            (point1.y <= edges_scaled.left_edge[1] || point1.y >= edges_scaled.right_edge[1]) ||
                            (point1.z <= edges_scaled.left_edge[2] || point1.z >= edges_scaled.right_edge[2])){            
                                if( dir.x+dir.y+dir.z <= 0 )  {   
                                    point1.x -= delta*dir.x
                                    point1.y -= delta*dir.y
                                    point1.z -= delta*dir.z
                                }
                                else{
                                    point1.x -= delta*dir.x
                                    point1.y -= delta*dir.y
                                    point1.z -= delta*dir.z
                                }
                                // console.log(point1)
                    }
                    // console.log('1/2')

                    let point2 = point1.clone()
                    console.log(point2)
                    while(  (point2.x >= edges_scaled.left_edge[0] && point2.x <= edges_scaled.right_edge[0]) &&
                            (point2.y >= edges_scaled.left_edge[1] && point2.y <= edges_scaled.right_edge[1]) &&
                            (point2.z >= edges_scaled.left_edge[2] && point2.z <= edges_scaled.right_edge[2])){
                                if( dir.x+dir.y+dir.z <= 0 )  {
                                    point2.x -= delta*dir.x
                                    point2.y -= delta*dir.y
                                    point2.z -= delta*dir.z
                                }
                                else{
                                    point2.x -= delta*dir.x
                                    point2.y -= delta*dir.y
                                    point2.z -= delta*dir.z
                                }

                    }
                    // console.log('2/2')
                    handleLine(dir,point1,point2)
                    // printLine(dir,point1,point2)
                }
                function handleLine(dir,point1,point2){
                    /**
                     * * handleLine() sends the line data to several destinations, to be drawn, saved, etc
                     */

                    idx = skewers.length
                    updateSkewerList(dir,idx,point1,point2)
                    saveLine(idx,point1,point2)
                    // sendLine(idx,point1,point2)
                    printLine(idx,point1,point2)
                }
                function printLine(idx,point1,point2){
                    /**
                     * * printLine() draws the skewer in the scene
                     */

                    positions = []
                    geometry = new THREE.LineGeometry();
                    positions.push(point1.x,point1.y,point1.z);
                    positions.push(point2.x,point2.y,point2.z);
                    geometry.setPositions(positions)
                    scene.remove(lines[idx])
                    var material = new THREE.LineMaterial( { 
                        color: 0xff5522,
                        linewidth: 0.0025,
                        transparent: true,
                        opacity: 0.7,
                        blending: THREE.AdditiveBlending

                    } );
                    lines[idx] = new THREE.Line2( geometry, material );
                    lines[idx].layers.set(4)
                    scene.add( lines[idx] );
                }

                

                function updateSkewerList(dir,idx,point1,point2){

                    /**
                     * * updateSkewerList() updates the skewer container UI for the corresponding line
                     */

                    dist = Math.sqrt( Math.pow((point1.x - point2.x),2) + Math.pow((point1.y - point2.y),2) + Math.pow((point1.z - point2.z),2))
                    //create div to hold skewer details
                    div = document.getElementById('skewer-coords')
                    id = 'skewer-coords-' + idx
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords" id="' + id + '"></div>');
                    
                    $("#" + id).hover(function(){
                        lines[idx].material.color = new THREE.Color(0,1,0)
                        }, function(){
                            lines[idx].material.color = new THREE.Color(0xff5522)
                    });
                    
                    //create div to show the line idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-number-' + idx
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-number" id='+ id +'>' + idx + ' <img id="delete-icon-"' + idx + '" class="delete-icon" src="static/assets/delete.svg" alt="delete line" role="button" onclick="deleteLine('+idx+')"  /> <img id="retry-icon-"' + idx + '" class="retry-icon" src="static/assets/refresh.svg" alt="retry line" role="button" onclick="retryLine('+idx+')"  /> </div>')

                    //create div to show pt1 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt1-range-' + idx + ''
                    id_range = "p1-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt1-range" id='+ id +'>point 1:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0"></div></div>')
                    div = document.getElementById(id)
                    id = "skewer-coords-point1-" + idx + ''
                    div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(point1.x,3) + ', ' + round(point1.y,3) + ', ' + round(point1.z,3) + ' )</div>')

                    //create div to show pt2 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt2-range-' + idx + ''
                    id_range = "p2-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt2-range" id="'+ id +'">point 2:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.00000001" value="0.0"></div></div>')
                    div = document.getElementById(id)
                    id = "skewer-coords-point2-" + idx + ''
                    div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id="' + id + '">( ' + round(point2.x,3) + ', ' + round(point2.y,3) + ', ' + round(point2.z,3) + ' ) </div>')

                    //create event listeners for the range sliders
                    p1slider = document.getElementById('p1-range-' + idx + '')
                    p1slider.oninput = function() {
                        slider = document.getElementById('p1-range-' + idx + '')
                        pt1 = []
                        pt1.x = point1.x - slider.value*dir.x
                        pt1.y = point1.y - slider.value*dir.y
                        pt1.z = point1.z - slider.value*dir.z

                        slider = document.getElementById('p2-range-' + idx + '')
                        pt2 = []
                        pt2.x = point2.x + slider.value*dir.x
                        pt2.y = point2.y + slider.value*dir.y
                        pt2.z = point2.z + slider.value*dir.z

                        id = "skewer-coords-point1-" + idx + ''
                        div = document.getElementById(id)
                        div.innerHTML = ''
                        div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt1.x,3) + ', ' + round(pt1.y,3) + ', ' + round(pt1.z,3) + ' )</div>')    
                        printLine(idx,pt1,pt2)
                        saveLine(idx,pt1,pt2)
                    }

                    //create event listeners for the range sliders
                    p2slider = document.getElementById('p2-range-' + idx + '')
                    p2slider.oninput = function() {
                        slider = document.getElementById('p1-range-' + idx + '')
                        pt1 = []
                        pt1.x = point1.x - slider.value*dir.x
                        pt1.y = point1.y - slider.value*dir.y
                        pt1.z = point1.z - slider.value*dir.z

                        slider = document.getElementById('p2-range-' + idx + '')
                        pt2 = []
                        pt2.x = point2.x + slider.value*dir.x
                        pt2.y = point2.y + slider.value*dir.y
                        pt2.z = point2.z + slider.value*dir.z
                        
                        id = "skewer-coords-point2-" + idx + ''
                        div = document.getElementById(id)
                        div.innerHTML = ''
                        div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(pt2.x,3) + ', ' + round(pt2.y,3) + ', ' + round(pt2.z,3) + ' )</div>')    
                        printLine(idx,pt1,pt2)
                        saveLine(idx,pt1,pt2)   
                    }

                    //create div for REQUEST button and STATUS message below skewer details
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords spectra-status" id="spectra-status-' + id + '">   <button type="button" onclick="requestSpectrum('+idx+')" class="request-button button spectra-status" id="request-button-' + idx + '">request spectrum</button> </div>');
                    div.insertAdjacentHTML('afterend', '<hr>')
                    
                }

                function saveLine(idx,point1,point2){
                    /**
                     * * saveLine() stores the coordinates in the skewer array for later reference
                     */
                    skewers[idx] = {
                        point1: point1,
                        point2: point2
                    }
                }

                function checkIfInside(ray){
                    /**
                     * * checkIfInside() is used to determine if the raycasted ray is within the boundaries of the data cube
                     */
                    if( (ray.x >= edges_scaled.left_edge[0] && ray.x <= edges_scaled.right_edge[0]) &&
                        (ray.y >= edges_scaled.left_edge[1] && ray.y <= edges_scaled.right_edge[1]) &&
                        (ray.z >= edges_scaled.left_edge[2] && ray.z <= edges_scaled.right_edge[2]) ){
                            return true
                        }
                    else{
                        return false
                    }
                }
            }
        }
        
    }
    
    function onMouseWheel( event ) {
    
    //   camera.position.z += event.deltaY * 0.01; // move camera along z-axis
    
    }

    function initColor(){
        // var color_picker = document.getElementsByClassName("color-picker");
        // for(i=0;i<color_picker.length;i++){
        //     color_picker[i].style.backgroundColor =  
        // }

        if( localStorage.getItem('gasMinCol') ){
            document.querySelector("#gasMinCol").value = localStorage.getItem('gasMinCol');
            document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
        }
        else{
            let col = new THREE.Color('rgb(0,200,240)')
            document.querySelector("#gasMinCol").value = '#'+col.getHexString();
        }
        document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value

        if( localStorage.getItem('gasMidCol') ){
            document.querySelector("#gasMidCol").value = localStorage.getItem('gasMidCol');
            document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value
        }
        else{
            let col = new THREE.Color('rgb(255,213,0)')
            document.querySelector("#gasMidCol").value = '#'+col.getHexString();
        }
        document.querySelector("#gasMidCol").style.backgroundColor = document.querySelector("#gasMidCol").value


        if( localStorage.getItem('gasMaxCol') ){
            document.querySelector("#gasMaxCol").value = localStorage.getItem('gasMaxCol');
        }
        else{
            let col = new THREE.Color('rgb(210,0,0)')
            document.querySelector("#gasMaxCol").value = '#'+col.getHexString();
        }
        document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value

        
        if( localStorage.getItem('dmMinCol') ){
            document.querySelector("#dmMinCol").value = localStorage.getItem('dmMinCol');
        }
        else{
            let col = new THREE.Color('rgb(255,0,255)')
            document.querySelector("#dmMinCol").value = '#'+col.getHexString();
        }
        document.querySelector("#dmMinCol").style.backgroundColor = document.querySelector("#dmMinCol").value

        if( localStorage.getItem('dmMaxCol') ){
            document.querySelector("#dmMaxCol").value = localStorage.getItem('dmMaxCol');
        }
        else{
            let col = new THREE.Color('rgb(255,0,255)')
            document.querySelector("#dmMaxCol").value = '#'+col.getHexString();
        }
        document.querySelector("#dmMaxCol").style.backgroundColor = document.querySelector("#dmMaxCol").value


        if( localStorage.getItem('starMinCol') ){
            document.querySelector("#starMinCol").value = localStorage.getItem('starMinCol');
        }
        else{
            let col = new THREE.Color('rgb(255,247,0)')
            document.querySelector("#starMinCol").value = '#'+col.getHexString();
        }
        document.querySelector("#starMinCol").style.backgroundColor = document.querySelector("#starMinCol").value

        if( localStorage.getItem('starMaxCol') ){
            document.querySelector("#starMaxCol").value = localStorage.getItem('starMaxCol');
        }
        else{
            let col = new THREE.Color('rgb(255,221,0)')
            document.querySelector("#starMaxCol").value = '#'+col.getHexString();
        }
        document.querySelector("#starMaxCol").style.backgroundColor = document.querySelector("#starMaxCol").value


        // if( localStorage.getItem('starCol') ){
        //     document.querySelector("#starCol").value = localStorage.getItem('starCol');
        // }
        // else{
        //     document.querySelector("#starCol").value = '#ffffff';
        // }
        // document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value


        if( localStorage.getItem('bhMinCol') ){
            document.querySelector("#bhMinCol").value = localStorage.getItem('bhMinCol');
        }
        else{
            document.querySelector("#bhMinCol").value = '#ffffff';
        }
        document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value


        if( localStorage.getItem('bhMaxCol') ){
            document.querySelector("#bhMaxCol").value = localStorage.getItem('bhMaxCol');
        }
        else{
            document.querySelector("#bhMaxCol").value = '#ffffff';
        }
        document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value


        changeColor()
    }   


    function onWindowResize(){
        camera.left = window.innerWidth/-2
        camera.right = window.innerWidth/2
        camera.top = window.innerHeight/2
        camera.bottom = window.innerHeight/-2
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );

        // renderer.setSize( window.innerWidth, window.innerHeight );
        // resizeRendererToDisplaySize(renderer)
        // function resizeRendererToDisplaySize(renderer) {
        //     const canvas = renderer.domElement;
        //     const pixelRatio = window.devicePixelRatio;
        //     const width  = window.innerWidth  * pixelRatio | 0;
        //     const height = window.innerHeight * pixelRatio | 0;
        //     const needResize = canvas.width !== width || canvas.height !== height;
        //     if (needResize) {
        //         renderer.setSize(width, height);
        //     }
        //     return needResize;
        // }
    
    }

    function onKeyDown(event){
        // console.log(event)
        var k = String.fromCharCode(event.keyCode);
        // console.log(k)

        if(k == "G"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work
             */
            if(!gasMesh){
                loadAttribute(gridsize,'PartType0','Temperature',false)
                var x = document.getElementById("gas-eye-open");
                x.style.display = "inline-block";
                var y = document.getElementById("gas-eye-closed");
                y.style.display = "none";
            }
            
        }
        if(k == "D"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
            if(!dmMesh){
                loadAttribute(gridsize,'PartType1','density',false)
                var x = document.getElementById("dm-eye-open");
                x.style.display = "inline-block";
                var y = document.getElementById("dm-eye-closed");
                y.style.display = "none";
            }
            
        }
        if(k == "S"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
        }
        if(k == "B"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
        }
        if(k == "L"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
            data_layers()
        }
        if(k == "O"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
            ray()
        }
        if(k == "P"){
            /*
             * * Turn gas visibility on an off
             TODO: make it work 
             */
            graph()
        }

        const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    }

    function exportData(name, text) {

        const a = document.createElement('a');
        const type = name.split(".").pop();
        a.href = URL.createObjectURL( new Blob([text], { type:`text/${type === "txt" ? "plain" : type}` }) );
        a.download = name;
        a.click();
    }
})