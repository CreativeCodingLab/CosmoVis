var container
var camera, scene, renderer, material, skewerScene
var points
var tex1 = new THREE.TextureLoader().load( "data/blur.png" );
var spinval = 0
var postprocessing = {};
var clock = new THREE.Clock();
var d = new THREE.Vector3();
// var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.getElementById("my-gui-container").appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='//mrdoob.github.io/stats.js/build/stats.min.js';document.head.appendChild(script);
var id;
var mouseMesh;
var raycaster
var pointclouds = []
var boxOfGasPoints
var boxOfDMPoints
var boxOfBHPoints
var boxOfStarPoints
var pickingScene
var pickingTexture
var pixelBuffer
var pickingData = []

var cube
var box
var particles = []
var gasParticles = []
var dmParticles = []
var starParticles = []
var bhParticles = []
var vec = new THREE.Vector3(); // create once and reuse
var pos = new THREE.Vector3();
const mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var plane = new THREE.Plane();
var planeNormal = new THREE.Vector3();
var point = new THREE.Vector3();
const target = new THREE.Vector2();
const windowHalf = new THREE.Vector2( window.innerWidth / 2, window.innerHeight / 2 );
var edges = []
var skewers = []
var field_list
var drawSkewers = false
var gasCoordLookup, dmCoordLookup, starCoordLookup, bhCoordLookup
var gasMinCol, gasMaxCol, dmMinCol, dmMaxCol, starMinCol, starMaxCol, bhMinCol, bhMaxCol
var line
var lines = []
var container_hover
var brusher

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function toggleDrawSkewerMode(){
    drawSkewers = !drawSkewers
    if(drawSkewers){
        document.getElementById('skewer-laser').style.filter = 'invert(98%) sepia(0%) saturate(51%) hue-rotate(144deg) brightness(117%) contrast(100%)'
    }
    else{
        document.getElementById('skewer-laser').style.filter = ''
    }
}

function toggleValueThreshold(type,e){
    
    if(type == 'gas' && e == 'min'){
        document.getElementById("gas-minval-input").disabled = (document.getElementById("gas-min-check").checked);
        if(document.getElementById("gas-min-check").checked){
            //materialGas.uniforms.min.value = min
            type = 'PartType0'
            attr = document.getElementById('gas_select').value
            findMinMax(type,attr,e)
        }
        else{
            materialGas.uniforms.min.value = document.getElementById('gas-minval-input').value
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

function changeValue(type,e){
    gm = document.querySelector('#gas-minval-input')
    gm.addEventListener('input', changeVal('gas','min',document.getElementById('gas-minval-input').value),true);
    
    gmx = document.querySelector('#gas-maxval-input')
    gmx.addEventListener('input',changeVal('gas','max', document.getElementById('gas-maxval-input').value),true);

    bhm = document.querySelector('#bh-minval-input')
    bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
    
    bhmx = document.querySelector('#bh-maxval-input')
    bhmx.addEventListener('input',changeVal('bh','max', document.getElementById('bh-maxval-input').value),true);
    
    function changeVal(type,e,val){
        if(type == 'gas' && e == 'min'){
            materialGas.uniforms.min.value = val
        }
        if(type == 'gas' && e == 'max'){
            materialGas.uniforms.max.value = val
        } 
        if(type == 'bh' && e == 'min'){
            materialBlackHole.uniforms.min.value = val
        }
        if(type == 'bh' && e == 'max'){
            materialBlackHole.uniforms.max.value = val
        }            
    }
}

function updateUnits(type,units){
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

function toggleBlendMode(num){
    if(num == 0){
        if(materialGas.blending == 5){ //Custom Blending
            materialGas.blending = THREE.AdditiveBlending
        }
        else{
            materialGas.blending = THREE.CustomBlending
        }
    }
    if(num == 1){
        if(materialDarkMatter.blending == 5){ //Custom Blending
            materialDarkMatter.blending = THREE.AdditiveBlending
        }
        else{
            materialDarkMatter.blending = THREE.CustomBlending
        }
    }
    if(num == 4){
        if(materialStar.blending == 5){ //Custom Blending
            materialStar.blending = THREE.AdditiveBlending
        }
        else{
            materialStar.blending = THREE.CustomBlending
        }
    }
    if(num == 5){
        if(materialBlackHole.blending == 5){ //Custom Blending
            materialBlackHole.blending = THREE.AdditiveBlending
        }
        else{
            materialBlackHole.blending = THREE.CustomBlending
        }
    }
}

function plotPoints(){
    
    let n_g = gasCoordLookup.length
    let n_d = dmCoordLookup.length
    let n_s = starCoordLookup.length
    let n_b = bhCoordLookup.length


    var gasgeometry = new THREE.BufferGeometry();
    var gasPositions = new Float32Array( n_g * 3 );
    var gasAttribute = new Float32Array( n_g * 1 );

    var dmgeometry = new THREE.BufferGeometry();
    var dmPositions = new Float32Array( n_d * 3 );
    var dmAttribute = new Float32Array( n_d * 1 );

    var stargeometry = new THREE.BufferGeometry();
    var starPositions = new Float32Array( n_s * 3 );
    var starAttribute = new Float32Array( n_s * 1 );

    var bhgeometry = new THREE.BufferGeometry();
    var bhPositions = new Float32Array( n_b * 3 );
    var bhAttribute = new Float32Array( n_b * 1 );


    gasAttr = document.getElementById('gas_select').value
    // dmAttr = document.getElementById('dm_select').value
    // starAttr = document.getElementById('star_select').value
    bhAttr = document.getElementById('bh_select').value

    if(gasParticles.length > 0){
        let count = 0
        for (i = 0; i < gasParticles.length; i++){
            if(gasParticles[i].attribute == gasAttr){
                for (j = 0; j < gasParticles[i].id.length; j++) {
                    let pos = gasCoordLookup[count];
                    let vertex = new THREE.Vector3( pos[0], pos[1], pos[2] )
                    
                    //let attr = (gasParticles[i].attr[j]-gasParticles[i].min)/(gasParticles[i].max-gasParticles[i].min)
                    let attr = gasParticles[i].attr[j]
                    
                    vertex.toArray( gasPositions, count * 3 );
                    gasAttribute[count] = attr;
                    count+=1
                }
            }
        }
        
        scene.remove(boxOfGasPoints)
        gasgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( gasPositions, 3 ).onUpload( disposeArray ));
        gasgeometry.addAttribute( 'gasAttribute', new THREE.Float32BufferAttribute( gasAttribute, 1 ).onUpload( disposeArray ));
        boxOfGasPoints = new THREE.Points( gasgeometry, materialGas );
        boxOfGasPoints.layers.set(0)
        pointclouds.push(boxOfGasPoints)
        scene.add( boxOfGasPoints );
    }
    else{
        for(i=0;i<gasCoordLookup.length;i++){
            let pos = gasCoordLookup[i];
            let vertex = new THREE.Vector3( pos[0], pos[1], pos[2] )
            vertex.toArray( gasPositions, i * 3 );
            gasAttribute[i] = 1.0;
        }   
        scene.remove(boxOfGasPoints)
        gasgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( gasPositions, 3 ).onUpload( disposeArray ));
        gasgeometry.addAttribute( 'gasAttribute', new THREE.Float32BufferAttribute( gasAttribute, 1 ).onUpload( disposeArray ));
        boxOfGasPoints = new THREE.Points( gasgeometry, materialGas );
        boxOfGasPoints.layers.set(0)
        pointclouds.push(boxOfGasPoints)
        scene.add( boxOfGasPoints );
    }

    if (dmParticles.length > 0){
        let count = 0
        for (i = 0; i < dmParticles.length; i++){
            if (dmParticles[i].attribute == dmAttr){
                for (j = 0; j < dmParticles[i].id.length; j++){
                    let pos = dmCoordLookup[count];
                    let vertex = new THREE.Vector3( pos[0], pos[1], pos[2] )
                    let attr = (dmParticles[i].attr[j]-dmParticles[i].min)/(dmParticles[i].max-dmParticles[i].min)
                    vertex.toArray( dmPositions, count * 3 );
                    dmAttribute[count] = 1.0;
                    count+=1
                }
            
                // let u = dmParticles[i]
                // var vertex = new THREE.Vector3( u.x, u.y, u.z )
                // var attr = dmParticles[i][dmAttr]
                // vertex.toArray( dmPositions, i * 3 );
                // // attr.toArray( dmAttribute, i * 1 )
                // dmAttribute[i] = attr;
            }
        }
        scene.remove(boxOfDMPoints)
        dmgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( dmPositions, 3 ).onUpload( disposeArray ));
        dmgeometry.addAttribute( 'dmAttribute', new THREE.Float32BufferAttribute( dmAttribute, 1 ).onUpload( disposeArray ));
        boxOfDMPoints = new THREE.Points( dmgeometry, materialDarkMatter );
        boxOfDMPoints.layers.set(1)
        pointclouds.push(boxOfDMPoints)
        scene.add( boxOfDMPoints );
    }
    else{
        for(i=0;i<dmCoordLookup.length;i++){
            let pos = dmCoordLookup[i];
            let vertex = new THREE.Vector3( pos[0], pos[1], pos[2] )
            vertex.toArray( dmPositions, i * 3 );
            dmAttribute[i] = 1.0;
        }   
        scene.remove(boxOfDMPoints)
        dmgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( dmPositions, 3 ).onUpload( disposeArray ));
        dmgeometry.addAttribute( 'dmAttribute', new THREE.Float32BufferAttribute( dmAttribute, 1 ).onUpload( disposeArray ));
        boxOfDMPoints = new THREE.Points( dmgeometry, materialDarkMatter );
        boxOfDMPoints.layers.set(1)
        pointclouds.push(boxOfDMPoints)
        scene.add( boxOfDMPoints );
    }

    if(starParticles.length > 0){
        let count = 0;
        for (i = 0; i < starParticles.length; i++){
            if(starParticles[i].attribute == starAttr){
                for (j = 0; j < starParticles[i].id.length; j++){
                    let pos = starCoordLookup[count];
                    let vertex = new THREE.Vector3( pos[1][0], pos[1][1], pos[1][2],6 )
                    let attr = (starParticles[i].attr[j]-starParticles[i].min)/(starParticles[i].max-starParticles[i].min)
                    vertex.toArray( starPositions, count * 3 );
                    starAttribute[count] = 1.0;
                    count+=1
                }
                // let u = starParticles[i]
                // var vertex = new THREE.Vector3( u.x, u.y, u.z )
                // var attr = u[starAttr]
                // vertex.toArray( starPositions, i * 3 );
                // starAttribute[i] = attr;
            }
        }

        scene.remove(boxOfStarPoints)
        stargeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( starPositions, 3 ).onUpload( disposeArray ));
        stargeometry.addAttribute( 'starAttribute', new THREE.Float32BufferAttribute( starAttribute, 1 ).onUpload( disposeArray ));
        boxOfStarPoints = new THREE.Points( stargeometry, materialStar );
        boxOfStarPoints.layers.set(2)
        pointclouds.push(boxOfStarPoints)
        scene.add( boxOfStarPoints );
    }
    else{
        for(i=0;i<starCoordLookup.length;i++){
            let pos = starCoordLookup[i];
            let vertex = new THREE.Vector3( pos[1][0], pos[1][1], pos[1][2],6 )
            vertex.toArray( starPositions, i * 3 );
            starAttribute[i] = 1.0;
        }   
        scene.remove(boxOfStarPoints)
        stargeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( starPositions, 3 ).onUpload( disposeArray ));
        stargeometry.addAttribute( 'starAttribute', new THREE.Float32BufferAttribute( starAttribute, 1 ).onUpload( disposeArray ));
        boxOfStarPoints = new THREE.Points( stargeometry, materialStar );
        boxOfStarPoints.layers.set(2)
        pointclouds.push(boxOfStarPoints)
        scene.add( boxOfStarPoints );
    }

    if(bhParticles.length > 0){
        let count = 0
        for (i = 0; i < bhParticles.length; i++){
            if(bhParticles[i].attribute == bhAttr){
                for (j = 0; j < bhParticles[i].id.length; j++){
                    let pos = bhCoordLookup[count];
                    let vertex = new THREE.Vector3( pos[1][0], pos[1][1], pos[1][2],6 )
                    let attr = (bhParticles[i].attr[j]-bhParticles[i].min)/(bhParticles[i].max-bhParticles[i].min)
                    vertex.toArray( bhPositions, count * 3 );
                    bhAttribute[count] = attr;
                    count+=1
                }
                // let u = bhParticles[i]
                // var vertex = new THREE.Vector3( u.x, u.y, u.z )
                // var attr = bhParticles[i][bhAttr]
                // vertex.toArray( bhPositions, i * 3 );
                // // attr.toArray( bhAttribute, i * 1)
                // bhAttribute[i] = attr;
            }
            
    
        }
        scene.remove(boxOfBHPoints)
        bhgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( bhPositions, 3 ).onUpload( disposeArray ));
        bhgeometry.addAttribute( 'bhAttribute', new THREE.Float32BufferAttribute( bhAttribute, 1 ).onUpload( disposeArray ));

        boxOfBHPoints = new THREE.Points( bhgeometry, materialBlackHole );
        boxOfBHPoints.layers.set(3)
        pointclouds.push(boxOfBHPoints)
        scene.add( boxOfBHPoints );
    }
    else{
        for(i=0;i<bhCoordLookup.length;i++){
            let pos = bhCoordLookup[i];
            let vertex = new THREE.Vector3( pos[1][0], pos[1][1], pos[1][2],6 )
            vertex.toArray( bhPositions, i * 3 );
            bhAttribute[i] = 1.0;
        }   
        scene.remove(boxOfBHPoints)
        bhgeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( bhPositions, 3 ).onUpload( disposeArray ));
        bhgeometry.addAttribute( 'bhAttribute', new THREE.Float32BufferAttribute( bhAttribute, 1 ).onUpload( disposeArray ));
        boxOfBHPoints = new THREE.Points( bhgeometry, materialBlackHole );
        boxOfBHPoints.layers.set(3)
        pointclouds.push(boxOfBHPoints)
        scene.add( boxOfBHPoints );
    }


    function disposeArray() {
        this.array = null;
    }

}
$(".container").hover(function(){
    container_hover = true;
    }, function(){
    container_hover = false;
});
function deleteLine(idx){
    let del = document.getElementById('skewer-coords-' + idx + '')
    del.remove()
    // let stat = document.getElementById('spectra-status-skewer-coords-' + idx + '')
    // stat.remove()
    scene.remove(lines[idx])
}

function retryLine(idx){
    requestSpectrum(idx)
}

function requestSpectrum(idx){
    pt1 = skewers[idx].point1
    pt2 = skewers[idx].point2    
    buttonId = 'request-button-' + idx + ''
    div = document.getElementById(buttonId)
    div.disabled = true
    sendLine(idx,pt1,pt2)
    div.innerText = 'requesting spectrum . . . '
}

function sendLine(idx,point1,point2){
    // socket.emit('selectRay',skewers.length-1, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
    socket.emit('selectRay',idx, [point1.x,point1.y,point1.z],[point2.x,point2.y,point2.z])
}

function plotSyntheticSpectrum(points) {
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
    
    console.log(domainLambda)
    xScale = d3.scaleLinear()
                .range([0, width + margin.left + margin.right])
                .domain(domainLambda);
                
    
    updateGraph()
    createBrush()
}

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
        console.log(s)
        console.log(ret)
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

$(document).ready(function(){

    $(".container").hover(function(){
        container_hover = true;
        }, function(){
        container_hover = false;
    });
    
    init()
    animate()
    render()
    function init(){

        
        
        THREE.Cache.enabled = true
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color("rgb(4,6,23)")

        var size = 8.47;
        var divisions = 10;

        // var gridHelper = new THREE.GridHelper( size, divisions, new THREE.Color( 0x000000 ), new THREE.Color( 0x000000 ) );
        // gridHelper.position.set(0,-8.47/2,8.47/2)
        // scene.add( gridHelper );
        // var gridHelper1 = new THREE.GridHelper( size, divisions, new THREE.Color( 0x000000 ), new THREE.Color( 0x000000 ) );
        // gridHelper1.position.set(0,0,0)
        // gridHelper1.rotateX(Math.PI/2)
        // scene.add( gridHelper1 );
        // var gridHelper2 = new THREE.GridHelper( size, divisions, new THREE.Color( 0x000000 ), new THREE.Color( 0x000000 ) );
        // gridHelper2.position.set(-8.47/2,0,8.47/2)
        // gridHelper2.rotateZ(Math.PI/2)
        // scene.add( gridHelper2 );
        
        // scene.fog = new THREE.FogExp2( 0x000000, 0.1 );
        var aspect = window.innerWidth / window.innerHeight;
        // camera = new THREE.PerspectiveCamera( 90, aspect, 0.0001, 400);
        camera = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 0.00001, 400 );
        
        camera.layers.enable(0);
        camera.layers.enable(1);
        camera.layers.enable(2);
        camera.layers.enable(3);
        camera.layers.enable(4);
        

        renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.antialias = true;
        renderer.precision = 'highp';
        renderer.powerPreference = 'high-performance'
        renderer.sortPoints = true;
        renderer.gammaFactor = 2.2;
        renderer.gammaOutput = true;
        renderer.logarithmicDepthBuffer = true
        
        camera.position.set(8.47, 8.47, 8.47)
        
        camera.zoom = 60
        // camera.lookAt(0,0,0)
        camera.updateProjectionMatrix();

        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        // edges.right_edge[0]-edges.left_edge[0], edges.right_edge[1]-edges.left_edge[1], edges.right_edge[2]-edges.left_edge[2]
        controls.target.set( 8.47/2, 8.47/2, 8.47/2 );
        // controls.enableDamping = true
        // controls.dampingFactor = 0.07;

        initMaterial();
        initColor();
        
        document.body.appendChild( renderer.domElement );
        document.addEventListener('keydown', onKeyDown, false)
        window.addEventListener( 'resize', onWindowResize, false );
        document.addEventListener( 'mousemove', onMouseMove, false );

        document.addEventListener( 'click', onMouseClick, false );
        document.addEventListener( 'wheel', onMouseWheel, false );


        gm = document.querySelector('#gas-minval-input')
        gm.addEventListener('input', changeVal('gas','min',document.getElementById('gas-minval-input').value),true);
        
        gmx = document.querySelector('#gas-maxval-input')
        gmx.addEventListener('input',changeVal('gas','min', document.getElementById('gas-maxval-input').value),true);
        
        bhm = document.querySelector('#bh-minval-input')
        bhm.addEventListener('input', changeVal('bh','min',document.getElementById('bh-minval-input').value),true);
        
        bhmx = document.querySelector('#bh-maxval-input')
        bhmx.addEventListener('input',changeVal('bh','min', document.getElementById('bh-maxval-input').value),true);
        

        function changeVal(type,e,val){
            if(type == 'gas' && e == 'min'){
                materialGas.uniforms.min.value = val
            }
            if(type == 'gas' && e == 'max'){
                materialGas.uniforms.max.value = val
            }   
            if(type == 'bh' && e == 'min'){
                materialBlackHole.uniforms.min.value = val
            }
            if(type == 'bh' && e == 'max'){
                materialBlackHole.uniforms.max.value = val
            }          
        }

        gmc = document.querySelector("#gasMinCol")
        gmc.addEventListener('change',changeColor,false);
        gmxc = document.querySelector("#gasMaxCol")
        gmxc.addEventListener('change',changeColor,false);
        
        dmc = document.querySelector("#dmCol")
        dmc.addEventListener('change',changeColor,false);
        // dmxc = document.querySelector("#dmMaxCol")
        // dmxc.addEventListener('change',changeColor,false);

        smc = document.querySelector("#starCol")
        smc.addEventListener('change',changeColor,false);
        // smxc = document.querySelector("#starMaxCol")
        // smxc.addEventListener('change',changeColor,false);

        bmc = document.querySelector("#bhMinCol")
        bmc.addEventListener('change',changeColor,false);
        bmxc = document.querySelector("#bhMaxCol")
        bmxc.addEventListener('change',changeColor,false);

        
        // document.addEventListener('mousemove', onMouseMove, false)

        loadData()
    }
    
    function onMouseMove( event ) {
        mouse.x = ( event.clientX - windowHalf.x );
        mouse.y = ( event.clientY - windowHalf.x );
        
    }
    function onMouseClick( event ) {

        
        //get mouse coordinates in screen space
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        //find start and end points on mouse click when drawSkewers is true
        if(drawSkewers && !container_hover){
            //get mouse position in screen space
            // let vector = new THREE.Vector3();
            // vector.set(
            //     (event.clientX / window.innerWidth) * 2 - 1,
            //     - (event.clientY / window.innerHeight) * 2 + 1,
            //     0
            // );

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
                // console.log(ray)
                // console.log(dir.x+dir.y+dir.z)
                //checks to see if the selected point is inside or outside of the domain of the data
                //in order to determine direction to move the points. incrementally moves the point
                //in the camera direction at a size delta until it reaches the boundary
                if(checkIfInside(ray)){
                    let point1 = ray.clone()
                    let point2 = ray.clone()
                    delta = 0.01

                    console.log('true')
                    

                    while(  (point1.x >= edges.left_edge[0] && point1.x <= edges.right_edge[0]) &&
                            (point1.y >= edges.left_edge[1] && point1.y <= edges.right_edge[1]) &&
                            (point1.z >= edges.left_edge[2] && point1.z <= edges.right_edge[2])){
                                
                                point1.x += delta*dir.x
                                point1.y += delta*dir.y
                                point1.z += delta*dir.z
                                
                    }
                    while(  (point2.x >= edges.left_edge[0] && point2.x <= edges.right_edge[0]) &&
                            (point2.y >= edges.left_edge[1] && point2.y <= edges.right_edge[1]) &&
                            (point2.z >= edges.left_edge[2] && point2.z <= edges.right_edge[2])){
                                
                                point2.x -= delta*dir.x
                                point2.y -= delta*dir.y
                                point2.z -= delta*dir.z
                    }
                    
                    printLine(point1,point2)
                }
                else{
                    console.log('false')
                    let point1 = ray.clone()
                    delta = 0.01
                    
                    while(  (point1.x <= edges.left_edge[0] || point1.x >= edges.right_edge[0]) ||
                            (point1.y <= edges.left_edge[1] || point1.y >= edges.right_edge[1]) ||
                            (point1.z <= edges.left_edge[2] || point1.z >= edges.right_edge[2])){            
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
                    }
                    // console.log('1/2')

                    let point2 = point1.clone()
                    while(  (point2.x >= edges.left_edge[0] && point2.x <= edges.right_edge[0]) &&
                            (point2.y >= edges.left_edge[1] && point2.y <= edges.right_edge[1]) &&
                            (point2.z >= edges.left_edge[2] && point2.z <= edges.right_edge[2])){
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
                    idx = skewers.length
                    updateSkewerList(dir,idx,point1,point2)
                    saveLine(idx,point1,point2)
                    // sendLine(idx,point1,point2)
                    printLine(idx,point1,point2)
                }
                function printLine(idx,point1,point2){
                    positions = []
                    geometry = new THREE.LineGeometry();
                    positions.push(point1.x,point1.y,point1.z);
                    positions.push(point2.x,point2.y,point2.z);
                    geometry.setPositions(positions)
                    scene.remove(lines[idx])
                    var material = new THREE.LineMaterial( { 
                        color: 0xff5522,
                        linewidth: 0.01,
                        transparent: true,
                        opacity: 0.7,
                        blending: THREE.AdditiveBlending

                    } );
                    lines[idx] = new THREE.Line2( geometry, material );
                    lines[idx].layers.set(4)
                    scene.add( lines[idx] );
                }

                

                function updateSkewerList(dir,idx,point1,point2){
                    // div = document.getElementById('skewer-coords-number')
                    // div.append(idx)
                    // div = document.getElementById('skewer-coords-point1')
                    // div.append(' ( ' + round(point1.x,3) + ', ' + round(point1.y,3) + ', ' + round(point1.z,3) + ' ) ')
                    // div = document.getElementById('skewer-coords-point2')
                    // div.append(' ( ' + round(point2.x,3) + ', ' + round(point2.y,3) + ', ' + round(point2.z,3) + ' ) ')
                    
                    // div = document.getElementById('skewer-coords-number')
                    // div.insertAdjacentHTML('beforeend', '<p>'+ idx +'</p>');

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
                    // div.insertAdjacentHTML('beforeend', '<div class="skewer-coords spectra-status" id="spectra-retry-' + idx + '" >    </div>')
                    // div.insertAdjacentHTML('beforeend','')

                    

                    //create div to show pt1 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt1-range-' + idx + ''
                    id_range = "p1-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt1-range" id='+ id +'>point 1:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.001" value="0.0"></div></div>')
                    div = document.getElementById(id)
                    id = "skewer-coords-point1-" + idx + ''
                    div.insertAdjacentHTML('beforeend','<div class="skewer-coords skewer-coords-values" id=' + id + '> ( ' + round(point1.x,3) + ', ' + round(point1.y,3) + ', ' + round(point1.z,3) + ' )</div>')

                    //create div to show pt2 details and range slider
                    id = 'skewer-coords-' + idx
                    div = document.getElementById(id)
                    id = 'skewer-coords-pt2-range-' + idx + ''
                    id_range = "p2-range-" + idx + ''
                    div.insertAdjacentHTML('beforeend', '<div class="skewer-coords skewer-coords-pt skewer-coords-pt2-range" id="'+ id +'">point 2:<div class="slider-wrapper"><input type="range" id="' + id_range + '" class="pt-range" min="0" max="' + dist + '" step="0.001" value="0.0"></div></div>')
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
                    
                    //<div class="spectra-request-status spectra-status" id="spectra-request-status-'+idx+'"></div> 
                    
                    

                }

                function saveLine(idx,point1,point2){
                    skewers[idx] = {
                        point1: point1,
                        point2: point2
                    }
                }

                function checkIfInside(ray){
                    if( (ray.x >= edges.left_edge[0] && ray.x <= edges.right_edge[0]) &&
                        (ray.y >= edges.left_edge[1] && ray.y <= edges.right_edge[1]) &&
                        (ray.z >= edges.left_edge[2] && ray.z <= edges.right_edge[2]) ){
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
            document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").valu
        }
        else{
            document.querySelector("#gasMinCol").value = '#ffffff';
        }
        document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
        
        if( localStorage.getItem('gasMaxCol') ){
            document.querySelector("#gasMaxCol").value = localStorage.getItem('gasMaxCol');
        }
        else{
            document.querySelector("#gasMaxCol").value = '#ffffff';
        }
        document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value

        
        if( localStorage.getItem('dmCol') ){
            document.querySelector("#dmCol").value = localStorage.getItem('dmCol');
        }
        else{
            document.querySelector("#dmCol").value = '#ffffff';
        }
        document.querySelector("#dmCol").style.backgroundColor = document.querySelector("#dmCol").value

        
        if( localStorage.getItem('starCol') ){
            document.querySelector("#starCol").value = localStorage.getItem('starCol');
        }
        else{
            document.querySelector("#starCol").value = '#ffffff';
        }
        document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value


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

    function initMaterial(){

        gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
        gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);

        dmCol = new THREE.Color(document.querySelector("#dmCol").value);
        // dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);

        starCol = new THREE.Color(document.querySelector("#starCol").value);
        // starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);

        bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
        bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

        materialGas = new THREE.ShaderMaterial( {

            uniforms: {

                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                min: { value: 0.0 },
                max: { value: 1.0 },
                minClip: { value: false },
                maxClip: { value: false },
                minCol: { value: new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0) },
                maxCol: { value: new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-gas' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-gas' ).textContent,

            blending:       THREE.CustomBlending,
            blendEquation: THREE.AddEquation, //default
            blendSrc: THREE.OneFactor,
            blendDst: THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     true,
            transparent:    true,
            // alphaTest:      0.1,
            opacity:    1.0,
            dithering: true


        });
        materialDarkMatter = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                Col: { value: new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0) },
                // maxCol: { value: new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0) }
            
            },
            vertexShader:   document.getElementById( 'vertexshader-darkmatter' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-darkmatter' ).textContent,

            blending:       THREE.AdditiveBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.2

        });
        materialBlackHole = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                min: { value: 0.0 },
                max: {value: 0.0 },
                minClip: { value: false },
                maxClip: { value: false },
                minCol: { value: new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0) },
                maxCol: { value: new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-blackhole' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-blackhole' ).textContent,
            

            // blending:       THREE.AdditiveBlending,
            blending:       THREE.CustomBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.3

        });

        materialStar = new THREE.ShaderMaterial( {

            uniforms: {
                texture:   { value: tex1 },
                zoom:   { value: camera.zoom },
                Col: { value: new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0) },
                // maxCol: { value: new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0) }
            },
            vertexShader:   document.getElementById( 'vertexshader-star' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader-star' ).textContent,

            // blending:       THREE.AdditiveBlending,
            blending:       THREE.CustomBlending,
            blendEquation:  THREE.AddEquation, //default
            blendSrc:       THREE.OneFactor,
            blendDst:       THREE.ZeroFactor,
            depthTest:      false,
            depthWrite:     false,
            transparent:    true,
            // alphaTest:      0.3

        });
    }

    function changeColor(){
        
        gasMinCol = new THREE.Color(document.querySelector("#gasMinCol").value);
        gasMaxCol = new THREE.Color(document.querySelector("#gasMaxCol").value);
        dmCol = new THREE.Color(document.querySelector("#dmCol").value);
        // dmMaxCol = new THREE.Color(document.querySelector("#dmMaxCol").value);
        starCol = new THREE.Color(document.querySelector("#starCol").value);
        // starMaxCol = new THREE.Color(document.querySelector("#starMaxCol").value);
        bhMinCol = new THREE.Color(document.querySelector("#bhMinCol").value);
        bhMaxCol = new THREE.Color(document.querySelector("#bhMaxCol").value);

        col = document.getElementById('gas-colorscale')
        col.style.background = 'linear-gradient( 0.25turn, #' + gasMinCol.getHexString() +', #' + gasMaxCol.getHexString() + ')'
        col = document.getElementById('bh-colorscale')
        col.style.background = 'linear-gradient( 0.25turn, #' + bhMinCol.getHexString() +', #' + bhMaxCol.getHexString() + ')'
        
        document.querySelector("#gasMinCol").style.backgroundColor = document.querySelector("#gasMinCol").value
        document.querySelector("#gasMaxCol").style.backgroundColor = document.querySelector("#gasMaxCol").value
        document.querySelector("#dmCol").style.backgroundColor = document.querySelector("#dmCol").value
        document.querySelector("#starCol").style.backgroundColor = document.querySelector("#starCol").value
        document.querySelector("#bhMinCol").style.backgroundColor = document.querySelector("#bhMinCol").value
        document.querySelector("#bhMaxCol").style.backgroundColor = document.querySelector("#bhMaxCol").value


        materialGas.uniforms.minCol.value = new THREE.Vector4(gasMinCol.r,gasMinCol.g,gasMinCol.b,1.0);
        materialGas.uniforms.maxCol.value = new THREE.Vector4(gasMaxCol.r,gasMaxCol.g,gasMaxCol.b,1.0);
        materialDarkMatter.uniforms.Col.value = new THREE.Vector4(dmCol.r,dmCol.g,dmCol.b,1.0);
        // materialDarkMatter.uniforms.maxCol.value = new THREE.Vector4(dmMaxCol.r,dmMaxCol.g,dmMaxCol.b,1.0);
        
        materialStar.uniforms.Col.value = new THREE.Vector4(starCol.r,starCol.g,starCol.b,1.0);
        // materialStar.uniforms.maxCol.value = new THREE.Vector4(starMaxCol.r,starMaxCol.g,starMaxCol.b,1.0);
        materialBlackHole.uniforms.minCol.value = new THREE.Vector4(bhMinCol.r,bhMinCol.g,bhMinCol.b,1.0);
        materialBlackHole.uniforms.maxCol.value = new THREE.Vector4(bhMaxCol.r,bhMaxCol.g,bhMaxCol.b,1.0);
    
        localStorage.setItem('gasMinCol', "#" + gasMinCol.getHexString());
        localStorage.setItem('gasMaxCol', "#" + gasMaxCol.getHexString());
        
        localStorage.setItem('dmCol', "#" + dmCol.getHexString());
        // localStorage.setItem('dmMaxCol', "#" + dmMaxCol.getHexString());
        
        localStorage.setItem('starCol', "#" + starCol.getHexString());
        // localStorage.setItem('starMaxCol', "#" + starMaxCol.getHexString());

        localStorage.setItem('bhMinCol', "#" + bhMinCol.getHexString());
        localStorage.setItem('bhMaxCol', "#" + bhMaxCol.getHexString());
    }

    
    function animate() {
        
        requestAnimationFrame( animate )
        materialGas.uniforms.zoom.value = camera.zoom
        materialDarkMatter.uniforms.zoom.value = camera.zoom
        materialStar.uniforms.zoom.value = camera.zoom
        materialBlackHole.uniforms.zoom.value = camera.zoom

    }

    function render() {

        requestAnimationFrame( render );
        controls.update()
        renderer.render( scene, camera );

    };
    
    function loadData(){

        d3.json('static/data/gasLookup-min.json').then(function(d){
            gasCoordLookup = d
            plotPoints()
        })
        d3.json('static/data/dmLookup-min.json').then(function(d){
            dmCoordLookup = d
            plotPoints()
        })
        d3.json('static/data/starLookup.json').then(function(d){
            starCoordLookup = d
        })
        d3.json('static/data/bhLookup.json').then(function(d){
            bhCoordLookup = d
        })

    }


    function onWindowResize(){

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    
        // renderer.setSize( window.innerWidth, window.innerHeight );
        resizeRendererToDisplaySize(renderer)
        function resizeRendererToDisplaySize(renderer) {
            const canvas = renderer.domElement;
            const pixelRatio = window.devicePixelRatio;
            const width  = window.innerWidth  * pixelRatio | 0;
            const height = window.innerHeight * pixelRatio | 0;
            const needResize = canvas.width !== width || canvas.height !== height;
            if (needResize) {
              renderer.setSize(width, height);
            }
            return needResize;
          }
    
    }

    function onKeyDown(event){
        // console.log(event)
        var k = String.fromCharCode(event.keyCode);
        // console.log(k)

        const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z };


        // if (k == '1'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: 0, y: 0, z: 10}, 60000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0) 
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
        // else if (k == '2'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: 0, y: 10, z: 0}, 60000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0)
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
        // else if (k == '3'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: 10, y: 0, z: 0}, 1000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0)
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
        // else if (k == '4'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: 0, y: 0, z: -10}, 1000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0)
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
        // else if (k == '5'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: 0, y: -10, z: 0}, 1000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0)
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
        // else if (k == '6'){
        //     // const coords = { x: camera.position.x, y: camera.position.y, z: camera.position.z }; // Start at (0, 0)
        //     const tween = new TWEEN.Tween(coords) // Create a new tween that modifies 'coords'.
        //             .to({ x: -10, y: 0, z: 0}, 1000) // Move to (300, 200) in 1 second.
        //             .easing(TWEEN.Easing.Linear.None) // Use an easing function to make the animation smooth.
        //             .onUpdate(() => { // Called after tween.js updates 'coords'.
        //                 camera.position.set(coords.x, coords.y, coords.z);
        //                 camera.lookAt(0, 0, 0)
        //                 // camera.lookAt(new THREE.Vector3(0,0,0));
        //             })
        //             .onComplete( function() {
        //                 // custom
        //                 cancelAnimationFrame( id );
        //             } )
        //             .start(); // Start the tween immediately.
        // }
    }

    function exportData(name, text) {

        const a = document.createElement('a');
        const type = name.split(".").pop();
        a.href = URL.createObjectURL( new Blob([text], { type:`text/${type === "txt" ? "plain" : type}` }) );
        a.download = name;
        a.click();
    }
})