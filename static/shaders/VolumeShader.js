/**
 * @author Almar Klein / http://almarklein.org
 *
 * Shaders to render 3D volumes using raycasting.
 * The applied techniques are based on similar implementations in the Visvis and Vispy projects.
 * This is not the only approach, therefore it's marked 1.
 */

THREE.VolumeRenderShader1 = {
    uniforms: {
        
		"u_size": { value: new THREE.Vector3( 1, 1, 1 ) },
		"u_renderstyle": { value: 0 },
		"u_renderthreshold": { value: 0.5 },
		"u_clim": { value: new THREE.Vector2( 1, 1 ) },
		"u_climDensity": { value: new THREE.Vector2( 1, 1 ) },
		"u_data": { value: null },
		"u_densityDepthMod": { value: null },
		"u_density": {value: null },
		"u_grayscaleDepthMod": { value: null },
		"u_dither": { value: null },
		"u_cmdata": { value: null },
		"u_clip": {value: [ false, false ]},
		"u_stepSize": { value: 1.0 },
		"u_xyzMin": {value: new THREE.Vector3( 0.0, 0.0, 0.0)},
		"u_xyzMax": {value: new THREE.Vector3( 1.0, 1.0, 1.0)},
		"u_densityModI": {value: null},
		"u_distMod": {value: null},
		"u_distModI": {value: null},
		"u_valMod": {value: null},
		"u_valModI": {value: null}
    },
	vertexShader: [
		
		"		varying vec4 v_nearpos;",
		"		varying vec4 v_farpos;",
		"		varying vec3 v_position;",
		"		varying vec3 v_cameraPosition;",

		"		mat4 inversemat(mat4 m) {",
		// Taken from https://github.com/stackgl/glsl-inverse/blob/master/index.glsl
		// This function is licenced by the MIT license to Mikola Lysenko
		"				float",
		"				a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],",
		"				a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],",
		"				a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],",
		"				a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],",

		"				b00 = a00 * a11 - a01 * a10,",
		"				b01 = a00 * a12 - a02 * a10,",
		"				b02 = a00 * a13 - a03 * a10,",
		"				b03 = a01 * a12 - a02 * a11,",
		"				b04 = a01 * a13 - a03 * a11,",
		"				b05 = a02 * a13 - a03 * a12,",
		"				b06 = a20 * a31 - a21 * a30,",
		"				b07 = a20 * a32 - a22 * a30,",
		"				b08 = a20 * a33 - a23 * a30,",
		"				b09 = a21 * a32 - a22 * a31,",
		"				b10 = a21 * a33 - a23 * a31,",
		"				b11 = a22 * a33 - a23 * a32,",

		"				det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;",

		"		return mat4(",
		"				a11 * b11 - a12 * b10 + a13 * b09,",
		"				a02 * b10 - a01 * b11 - a03 * b09,",
		"				a31 * b05 - a32 * b04 + a33 * b03,",
		"				a22 * b04 - a21 * b05 - a23 * b03,",
		"				a12 * b08 - a10 * b11 - a13 * b07,",
		"				a00 * b11 - a02 * b08 + a03 * b07,",
		"				a32 * b02 - a30 * b05 - a33 * b01,",
		"				a20 * b05 - a22 * b02 + a23 * b01,",
		"				a10 * b10 - a11 * b08 + a13 * b06,",
		"				a01 * b08 - a00 * b10 - a03 * b06,",
		"				a30 * b04 - a31 * b02 + a33 * b00,",
		"				a21 * b02 - a20 * b04 - a23 * b00,",
		"				a11 * b07 - a10 * b09 - a12 * b06,",
		"				a00 * b09 - a01 * b07 + a02 * b06,",
		"				a31 * b01 - a30 * b03 - a32 * b00,",
		"				a20 * b03 - a21 * b01 + a22 * b00) / det;",
		"		}",


		"		void main() {",
		"				vec3 v_cameraPosition = cameraPosition;",
		// Prepare transforms to map to "camera view". See also:
		// https://threejs.org/docs/#api/renderers/webgl/WebGLProgram
		"				mat4 viewtransformf = modelViewMatrix;",
		"				mat4 viewtransformi = inversemat(modelViewMatrix);",

		// Project local vertex coordinate to camera position. Then do a step
		// backward (in cam coords) to the near clipping plane, and project back. Do
		// the same for the far clipping plane. This gives us all the information we
		// need to calculate the ray and truncate it to the viewing cone.
		"				vec4 position4 = vec4(position, 1.0);",
		"				vec4 pos_in_cam = viewtransformf * position4;",

		// Intersection of ray and near clipping plane (z = -1 in clip coords)
		"				pos_in_cam.z = -pos_in_cam.w;",
		"				v_nearpos = viewtransformi * pos_in_cam;",

		// Intersection of ray and far clipping plane (z = +1 in clip coords)
		"				pos_in_cam.z = pos_in_cam.w;",
		"				v_farpos = viewtransformi * pos_in_cam;",

		// Set varyings and output pos
		"				v_position = position;",
		"				gl_Position = projectionMatrix * viewMatrix * modelMatrix * position4;",
		"		}",
	].join( "\n" ),
	fragmentShader: [
		"		precision highp float;",
		"		precision mediump sampler3D;",

		"		uniform vec3 u_size;",
		"		uniform int u_renderstyle;",
		"		uniform float u_renderthreshold;",
		"		uniform vec2 u_clim;",
		"		uniform vec2 u_climDensity;",
		"		uniform bvec2 u_clip;",
		"		uniform float u_stepSize;",

		"		uniform sampler3D u_data;",
		"		uniform float u_densityDepthMod;",
		"		uniform float u_grayscaleDepthMod;",
		"		uniform float u_dither;",
		"		uniform vec3 u_xyzMin;",
		"		uniform vec3 u_xyzMax;",
		"		uniform float u_distMod;",
		"		uniform float u_valMod;",

		"		uniform float u_densityModI;",
		"		uniform float u_distModI;",
		"		uniform float u_valModI;",

		"		uniform sampler3D u_density;",
		"		uniform sampler2D u_cmdata;",

		"		varying vec3 v_cameraPosition;",
		"		varying vec3 v_position;",
		"		varying vec4 v_nearpos;",
		"		varying vec4 v_farpos;",
		

		// The maximum distance through our rendering volume is sqrt(3)*size.
		"		const int MAX_STEPS = 887;	// 887 for 512^3, 1774 for 1024^3",
		"		const int REFINEMENT_STEPS = 4;",
		"		const float relative_step_size = 1.0;",
		"		const vec4 ambient_color = vec4(0.2, 0.4, 0.2, 1.0);",
		"		const vec4 diffuse_color = vec4(0.8, 0.2, 0.2, 1.0);",
		"		const vec4 specular_color = vec4(1.0, 1.0, 1.0, 1.0);",
		"		const float shininess = 40.0;",

		"		void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);",
		"		void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);",
		"		vec3 grayscale(vec3 inputColor);",
		"		vec3 grayscaleAmount(vec3 inputColor, float amount);",
		"		float sample1(vec3 texcoords);",
		"		vec4 apply_colormap(float val);",
		"		vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray);",


		"		void main() {",
		// Normalize clipping plane info
		"				vec3 farpos = v_farpos.xyz / v_farpos.w;",
		"				vec3 nearpos = v_nearpos.xyz / v_nearpos.w;",
		// Calculate unit vector pointing in the view direction through this fragment.
		"				vec3 view_ray = normalize(nearpos.xyz - farpos.xyz);",

		// Compute the (negative) distance to the front surface or near clipping plane.
		// v_position is the back face of the cuboid, so the initial distance calculated in the dot
		// product below is the distance from near clip plane to the back of the cuboid
		"				float distance = dot(nearpos - v_position, view_ray);",
		"				distance = max(distance, min((-0.5 - v_position.x) / view_ray.x,",
		"																		(u_size.x - 0.5 - v_position.x) / view_ray.x));",
		"				distance = max(distance, min((-0.5 - v_position.y) / view_ray.y,",
		"																		(u_size.y - 0.5 - v_position.y) / view_ray.y));",
		"				distance = max(distance, min((-0.5 - v_position.z) / view_ray.z,",
		"																		(u_size.z - 0.5 - v_position.z) / view_ray.z));",

		// Now we have the starting position on the front surface
		"				vec3 front = v_position + view_ray * distance;",

		// Decide how many steps to take
		// "				int nsteps = int(-distance / relative_step_size + 0.5);",
		"				int nsteps = int(-distance / u_stepSize + 0.5);",
		"				if ( nsteps < 1 )",
		"						discard;",

		// Get starting location and step vector in texture coordinates
		"				vec3 step = ((v_position - front) / u_size) / float(nsteps);",
		"				vec3 start_loc = front / u_size;",

		// For testing: show the number of steps. This helps to establish
		// whether the rays are correctly oriented
		//'gl_FragColor = vec4(0.0, float(nsteps) / 1.0 / u_size.x, 1.0, 1.0);',
		//'return;',

		"				if (u_renderstyle == 0)",
		"						cast_dvr(start_loc, step, nsteps, view_ray);",
		"				else if (u_renderstyle == 1)",
		"						cast_iso(start_loc, step, nsteps, view_ray);",
		// "				if (gl_FragColor.a < 0.05)",
		// "						discard;",
		"		}",


		"		float sample1(vec3 texcoords) {",
		"				/* Sample float value from a 3D texture. Assumes intensity data. */",
		"				return texture(u_data, texcoords.xyz).r;",
		"		}",
		"		float sampleDensity(vec3 texcoords) {",
		"				/* Sample float value from a 3D texture. Assumes intensity data. */",
		"				return texture(u_density, texcoords.xyz).r;",
		"		}",

		"		vec4 apply_colormap(float val) {",
		"				vec4 tex = texture2D(u_cmdata, vec2(val, 0.5));",
		"				return tex;",
		"		}",
		"		float rand(float n){return fract(sin(n) * 43758.5453123);}",
		"		float noise(float p){",
		"			float fl = floor(p);",
		"			float fc = fract(p);",
		"			return mix(rand(fl),rand(fl+1.0),fc);",
		"		}",
		"		vec3 grayscale(vec3 inputColor){",
		"			float gray = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722 ));",
		"			return vec3(gray, gray, gray);",
		"		}",
		"		vec3 grayscaleAmount(vec4 inputColor, float amount){",
		"			vec3 outputColor = mix(inputColor.rgb, grayscale(inputColor.rgb), amount/1.6);",
		"			return outputColor;",
		"		}",

		"		vec4 apply_dvr_colormap(float val, float density, float dist, vec3 texcoords) {",
		"				float a;",
		"				float d;",
		"				float delta = distance(v_cameraPosition,texcoords);",
		"				if(u_densityDepthMod == 1.0){",
		"					d = ((density - u_climDensity[0]) / (u_climDensity[1] - u_climDensity[0]));",
		"				}",
		"				else{",
		"					d = 0.5;",
		"				}",
		"				if( (u_clip[0] == true) && (val < u_clim[0]) ){",
		"					a = 0.0;",
		"				}",
		"				else if( (u_clip[1] == true) && (val > u_clim[1]) ){",
		"					a = 0.0;",
		"				}",
		// "				if(val<u_clim[0] || val > u_clim[1]){",
		// "					a = 0.0;",
		// "				}",
		"				else{",
		"					a = d;",
		"				}",
		"				val = (val - u_clim[0]) / (u_clim[1] - u_clim[0]);",
		"				if(a != 0.0 && val<=0.5){",
		"					a = (u_densityModI*d+u_valModI*val*u_valMod+u_distModI*delta*u_distMod)/3.0;",
		"				}",
		"				else if (a != 0.0){",
		"					a = (u_densityModI*d+u_valModI*val*u_valMod+u_distModI*delta*u_distMod)/3.0;",
		"				}",
		"				vec4 tex = texture2D(u_cmdata, vec2(val, 0.5));",
		"				tex.rgb = tex.rgb;",
		"				tex.a = a;",
		"				if(u_grayscaleDepthMod == 1.0){",
		"					tex.rgb = grayscaleAmount(tex, (1.0-(dist*dist)));",
		"				}",
		"				return tex;",
		"		}",

		
		"		void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {",
		"				float max_val = -1e6;",
		"				int max_i = 100;",
		"				vec3 loc = start_loc;",
		"				float val = sample1(loc);",
		"				float density = sampleDensity(loc);",
		"				vec4 c;",
		"				if((loc.x>u_xyzMin[0] && loc.x<u_xyzMax[0]) && (loc.y>u_xyzMin[1] && loc.y<u_xyzMax[1]) && (loc.z>u_xyzMin[2] && loc.z<u_xyzMax[2])){",
		"					c = apply_dvr_colormap(val,density,0.0,loc);",
		"				}",
		"				else{ c = vec4(0.0156,0.0234,0.0898,0.0); }",
		// "				c.a = 0.5;",
		// Enter the raycasting loop. In WebGL 1 the loop index cannot be compared with
		// non-constant expression. So we use a hard-coded max, and an additional condition
		// inside the loop.
		"				for (int iter=0; iter<int(float(MAX_STEPS)/u_stepSize); iter++) {",
		"						if (iter >= nsteps)",
		"								break;",
		// Sample from the 3D texture
		"						float val = sample1(loc);",
		"						float density = sampleDensity(loc);",

		// Apply composite step
		"						float dist;",
		"						if(u_dither == 1.0){",
		"							dist = noise(float(nsteps-iter)/float(nsteps));",
		"						}",
		"						else{",
		"							dist = float(nsteps-iter)/float(nsteps);",
		"						}",
		"						vec4 c_i;",
		"						if((loc.x>u_xyzMin[0] && loc.x<u_xyzMax[0]) && (loc.y>u_xyzMin[1] && loc.y<u_xyzMax[1]) && (loc.z>u_xyzMin[2] && loc.z<u_xyzMax[2])){",
		"							c_i = apply_dvr_colormap(val,density,dist,loc);",
		"							float c_i_r = c.r*c.a + c_i.r*(1.0-c.a);",
		"							float c_i_g = c.g*c.a + c_i.g*(1.0-c.a);",
		"							float c_i_b = c.b*c.a + c_i.b*(1.0-c.a);",
		"							float c_i_a = c.a + c_i.a*(1.0-c.a);",
		"							c = vec4(c_i_r,c_i_g,c_i_b,c_i_a);",
		"						}",
		"						else{",
		// "							c_i = vec4(0.0156,0.0234,0.0898,0.0);",
		"						}",


		// "						c_i.a = 0.1;",


		// "						if(c.a > 0.99){",
		// "							break;",
		// "						}",

		// Advance location deeper into the volume
		"						loc += step;",
		"				}",

		// Refine location, gives crispier images
		"				vec3 iloc = start_loc + step * (float(max_i) - 0.5);",
		"				vec3 istep = step / float(REFINEMENT_STEPS);",
		"				for (int i=0; i<REFINEMENT_STEPS; i++) {",
		"						max_val = max(max_val, sample1(iloc));",
		"						iloc += istep;",
		"				}",

		// Resolve final color
		"				gl_FragColor = c;",
		"		}",


		"		void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {",

		"				gl_FragColor = vec4(0.0);	// init transparent",
		"				vec4 color3 = vec4(0.0);	// final color",
		"				vec3 dstep = 1.5 / u_size;	// step to sample derivative",
		"				vec3 loc = start_loc;",

		"				float low_threshold = u_renderthreshold - 0.02 * (u_clim[1] - u_clim[0]);",

		// Enter the raycasting loop. In WebGL 1 the loop index cannot be compared with
		// non-constant expression. So we use a hard-coded max, and an additional condition
		// inside the loop.
		"				for (int iter=0; iter<MAX_STEPS; iter++) {",
		"						if (iter >= nsteps)",
		"								break;",

		// Sample from the 3D texture
		"						float val = sample1(loc);",

		"						if (val > low_threshold) {",
		// Take the last interval in smaller steps
		"								vec3 iloc = loc - 0.5 * step;",
		"								vec3 istep = step / float(REFINEMENT_STEPS);",
		"								for (int i=0; i<REFINEMENT_STEPS; i++) {",
		"										val = sample1(iloc);",
		"										if (val > u_renderthreshold) {",
		"												gl_FragColor = add_lighting(val, iloc, dstep, view_ray);",
		"												return;",
		"										}",
		"										iloc += istep;",
		"								}",
		"						}",

		// Advance location deeper into the volume
		"						loc += step;",
		"				}",
		"		}",


		"		vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray)",
		"		{",
		// Calculate color by incorporating lighting

		// View direction
		"				vec3 V = normalize(view_ray);",

		// calculate normal vector from gradient
		"				vec3 N;",
		"				float val1, val2;",
		"				val1 = sample1(loc + vec3(-step[0], 0.0, 0.0));",
		"				val2 = sample1(loc + vec3(+step[0], 0.0, 0.0));",
		"				N[0] = val1 - val2;",
		"				val = max(max(val1, val2), val);",
		"				val1 = sample1(loc + vec3(0.0, -step[1], 0.0));",
		"				val2 = sample1(loc + vec3(0.0, +step[1], 0.0));",
		"				N[1] = val1 - val2;",
		"				val = max(max(val1, val2), val);",
		"				val1 = sample1(loc + vec3(0.0, 0.0, -step[2]));",
		"				val2 = sample1(loc + vec3(0.0, 0.0, +step[2]));",
		"				N[2] = val1 - val2;",
		"				val = max(max(val1, val2), val);",

		"				float gm = length(N); // gradient magnitude",
		"				N = normalize(N);",

		// Flip normal so it points towards viewer
		"				float Nselect = float(dot(N, V) > 0.0);",
		"				N = (2.0 * Nselect - 1.0) * N;	// ==	Nselect * N - (1.0-Nselect)*N;",

		// Init colors
		"				vec4 ambient_color = vec4(0.0, 0.0, 0.0, 0.0);",
		"				vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);",
		"				vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);",

		// note: could allow multiple lights
		"				for (int i=0; i<1; i++)",
		"				{",
								 // Get light direction (make sure to prevent zero devision)
		"						vec3 L = normalize(view_ray);	//lightDirs[i];",
		"						float lightEnabled = float( length(L) > 0.0 );",
		"						L = normalize(L + (1.0 - lightEnabled));",

		// Calculate lighting properties
		"						float lambertTerm = clamp(dot(N, L), 0.0, 1.0);",
		"						vec3 H = normalize(L+V); // Halfway vector",
		"						float specularTerm = pow(max(dot(H, N), 0.0), shininess);",

		// Calculate mask
		"						float mask1 = lightEnabled;",

		// Calculate colors
		"						ambient_color +=	mask1 * ambient_color;	// * gl_LightSource[i].ambient;",
		"						diffuse_color +=	mask1 * lambertTerm;",
		"						specular_color += mask1 * specularTerm * specular_color;",
		"				}",

		// Calculate final color by componing different components
		"				vec4 final_color;",
		"				vec4 color = apply_colormap(val);",
		"				final_color = color * (ambient_color + diffuse_color) + specular_color;",
		"				final_color.a = 0.1;",
		"				return final_color;",
		"		}",
	].join( "\n" )
};