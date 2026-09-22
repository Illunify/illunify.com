gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
ScrollSmoother.get() || ScrollSmoother.create({ smooth: 1.25, smoothTouch: .125, normalizeScroll: true, ignoreMobileResize: true });
'use strict'
  ; (function () {
    var canvas = document.getElementById('GL')
    var DS = { ...document.body.dataset }
    new URLSearchParams(location.search).forEach(function (v, k) {
      DS[k.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase() })] = v
    })
    var gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return
    var dnum = function (k, f) {
      var v = Number.parseFloat(DS[k])
      return Number.isFinite(v) ? v : f
    }
    var CSSV = getComputedStyle(document.documentElement)
    var HEX = function (v, f) {
      v = String(v == null ? '' : v).trim()
      return /^#([A-Fa-f\d]{3}|[A-Fa-f\d]{6})$/.test(v) ? v : f
    }
    var rgb = function (h) {
      h = h.slice(1)
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      var n = Number.parseInt(h, 16)
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (c) {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
    }
    var tok = function (n, f) { return rgb(HEX(CSSV.getPropertyValue(n), f)) }
    var BGHEX = HEX(CSSV.getPropertyValue('--BACKGROUND'), '#e0e0e0')
    var BG = rgb(BGHEX)
    var luma = function (c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    var BGL = luma(BG)
    var TXL = luma(tok('--COLOR', '#000'))
    var MINL = TXL < BGL ? Math.min(1, Math.max(0, Math.max(1, dnum('liquidTextContrast', 10)) * (TXL + 0.05) - 0.05 + 0.005)) : 0
    var LAYER = /^(1|top|over|front)$/i.test(String(DS.liquidLayer || '')) ? 1 : 0
    canvas.style.zIndex = LAYER ? '30' : '0'
    canvas.style.mixBlendMode = 'normal'
    canvas.style.pointerEvents = LAYER ? 'none' : 'auto'
    var RES = Math.max(1, dnum('liquidRes', 3))
    var SCALES = Math.max(1, Math.min(12, Math.round(dnum('liquidScales', 10))))
    var ASTEP = Math.max(1, Math.min(8, Math.round(dnum('liquidAdvSteps', 5))))
    var STEPS = Math.max(1, Math.min(12, Math.round(dnum('glassSteps', 10))))
    var QUIET = Math.max(0.1, dnum('liquidQuiet', 3))
    var FPS = 60
    var LIFE = Math.max(0.05, dnum('liquidSmearLife', 1))
    var VTAU = Math.max(0.05, dnum('liquidVelLife', 0.4))
    var VLAP = Math.max(0, dnum('liquidVelLap', 0.05))
    var DAMPOVR = DS.liquidDamp !== undefined ? Number.parseFloat(DS.liquidDamp) : null
    var VS = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`
    var HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 O;
uniform vec2 uSim;
uniform float uMaxLod;
float reduce(mat3 a,mat3 b){mat3 p=matrixCompMult(a,b);return p[0][0]+p[0][1]+p[0][2]+p[1][0]+p[1][1]+p[1][2]+p[2][0]+p[2][1]+p[2][2];}
vec2 normz(vec2 x){return x==vec2(0.0)?vec2(0.0):normalize(x);}
vec2 cl0(vec2 p){return clamp(p,0.0,1.0);}
#define F9(S,M) vec4 d=textureLod(S,cl0(uv+t.ww),M),dn=textureLod(S,cl0(uv+t.wy),M),de=textureLod(S,cl0(uv+t.xw),M),ds=textureLod(S,cl0(uv+t.wz),M),dw=textureLod(S,cl0(uv-t.xw),M),dnw=textureLod(S,cl0(uv-t.xz),M),dsw=textureLod(S,cl0(uv-t.xy),M),dne=textureLod(S,cl0(uv+t.xy),M),dse=textureLod(S,cl0(uv+t.xz),M);
#define M9(C) mat3(dnw.C,dn.C,dne.C,dw.C,d.C,de.C,dsw.C,ds.C,dse.C)
`
    var FB = HEAD + `#define SCALES ${SCALES}
uniform sampler2D uA;
uniform float uTurbIso,uCurlIso,uShift;
void main(){
vec2 uv=gl_FragCoord.xy/uSim+vec2(0.0,uShift);
mat3 txx=(2.0-uTurbIso)*mat3(0.125,0.25,0.125,-0.25,-0.5,-0.25,0.125,0.25,0.125);
mat3 tyy=(2.0-uTurbIso)*mat3(0.125,-0.25,0.125,0.25,-0.5,0.25,0.125,-0.25,0.125);
mat3 txy=uTurbIso*mat3(0.25,0.0,-0.25,0.0,0.0,0.0,-0.25,0.0,0.25);
float c0=uCurlIso;
mat3 cx=mat3(c0,1.0,c0,0.0,0.0,0.0,-c0,-1.0,-c0);
mat3 cy=mat3(c0,0.0,-c0,1.0,0.0,-1.0,c0,0.0,-c0);
float nrm=8.8/(4.0+8.0*uCurlIso);
vec2 v=vec2(0.0),sv=vec2(0.0);
float curl=0.0,cw=0.0,sc=0.0,lm=-1.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
if(mip>lm){
lm=mip;
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
F9(uA,mip)
mat3 mx=M9(x),my=M9(y);
sv=vec2(reduce(txx,mx)+reduce(txy,my),reduce(tyy,my)+reduce(txy,mx));
sc=reduce(cx,mx)+reduce(cy,my);}
float cwf=1.0/float(i+1);
v+=sv;
curl+=cwf*sc;
cw+=cwf;}
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
O=vec4(v,0.0,nrm*curl/cw)*smoothstep(0.0,sw,uShift<0.0?uv.y:1.0-uv.y);}`
    var FC = HEAD + `#define SCALES ${SCALES}
uniform sampler2D uB;
uniform float uConfIso;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
float k0=uConfIso,k1=1.0-2.0*uConfIso;
mat3 cx=mat3(-k0,-k1,-k0,0.0,0.0,0.0,k0,k1,k0);
mat3 cy=mat3(-k0,0.0,k0,-k1,0.0,k1,-k0,0.0,k0);
vec2 v=vec2(0.0),sv=vec2(0.0);
float lm=-1.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
if(mip>lm){
lm=mip;
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
F9(uB,mip)
mat3 mc=M9(w);
mc=mat3(abs(mc[0]),abs(mc[1]),abs(mc[2]));
sv=d.w*normz(vec2(reduce(cx,mc),reduce(cy,mc)));}
v+=sv;}
O=vec4(v/float(SCALES),0.0,0.0);}`
    var FD = HEAD + `#define SCALES ${SCALES}
uniform sampler2D uA,uP;
uniform float uPoisIso,uShift;
void main(){
vec2 uv=gl_FragCoord.xy/uSim+vec2(0.0,uShift);
float k0=uPoisIso,k1=1.0-2.0*uPoisIso;
mat3 px=mat3(k0,0.0,-k0,k1,0.0,-k1,k0,0.0,-k0);
mat3 py=mat3(-k0,-k1,-k0,0.0,0.0,0.0,k0,k1,k0);
mat3 gs=mat3(0.0625,0.125,0.0625,0.125,0.25,0.125,0.0625,0.125,0.0625);
vec2 v=vec2(0.0),sv=vec2(0.0);
float wc=0.0,lm=-1.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
if(mip>lm){
lm=mip;
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
mat3 mx,my,mp;
{F9(uA,mip) mx=M9(x); my=M9(y);}
{F9(uP,mip) mp=M9(x);}
sv=vec2(reduce(px,mx)+reduce(py,my),reduce(gs,mp));}
float w=1.0/float(i+1);
wc+=w;
v+=w*sv;}
v/=wc;
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
O=vec4(v.x+v.y)*smoothstep(0.0,sw,uShift<0.0?uv.y:1.0-uv.y);}`
    var FA = HEAD + `#define ASTEP ${ASTEP}
uniform sampler2D uA,uB,uC,uP;
uniform vec4 uSeg;
uniform float uAdvScale,uAdvTurb,uAdvConf,uAdvVel,uAdvDiv,uVelTurb,uVelConf,uVelLap,uDivMin,uDamp,uVelScale,uForce,uRadius,uActive,uShift;
vec2 diffP(vec2 uv){
vec2 tx=1.0/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
vec4 dn=texture(uP,cl0(uv+t.wy));
vec4 de=texture(uP,cl0(uv+t.xw));
vec4 ds=texture(uP,cl0(uv+t.wz));
vec4 dw=texture(uP,cl0(uv-t.xw));
vec4 dnw=texture(uP,cl0(uv-t.xz));
vec4 dsw=texture(uP,cl0(uv-t.xy));
vec4 dne=texture(uP,cl0(uv+t.xy));
vec4 dse=texture(uP,cl0(uv+t.xz));
return vec2(0.5*(de.x-dw.x)+0.25*(dne.x-dnw.x+dse.x-dsw.x),0.5*(dn.x-ds.x)+0.25*(dne.x+dnw.x-dse.x-dsw.x));}
vec2 lapV(vec2 uv){
const float K0=-20.0/6.0,K1=4.0/6.0,K2=1.0/6.0;
vec2 tx=1.0/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
vec2 d=texture(uA,cl0(uv+t.ww)).xy;
vec2 dn=texture(uA,cl0(uv+t.wy)).xy;
vec2 de=texture(uA,cl0(uv+t.xw)).xy;
vec2 ds=texture(uA,cl0(uv+t.wz)).xy;
vec2 dw=texture(uA,cl0(uv-t.xw)).xy;
vec2 dnw=texture(uA,cl0(uv-t.xz)).xy;
vec2 dsw=texture(uA,cl0(uv-t.xy)).xy;
vec2 dne=texture(uA,cl0(uv+t.xy)).xy;
vec2 dse=texture(uA,cl0(uv+t.xz)).xy;
return K0*d+K1*(de+dw+dn+ds)+K2*(dne+dnw+dse+dsw);}
vec2 svSeg(vec2 p,vec2 a,vec2 b){vec2 ab=b-a,ap=p-a;return ap-ab*clamp(dot(ap,ab)/max(dot(ab,ab),1e-9),0.0,1.0);}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 tx=1.0/uSim;
vec2 sh=vec2(0.0,uShift);
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
float syy=uv.y+uShift;
float sg=smoothstep(0.0,sw,uShift<0.0?syy:1.0-syy);
vec2 turb=vec2(0.0),conf=vec2(0.0),dv=vec2(0.0),dvel=vec2(0.0),off=vec2(0.0),lp=vec2(0.0);
vec4 vel=vec4(0.0),adv=vec4(0.0);
for(int i=0;i<ASTEP;i++){
turb=texture(uB,cl0(uv+tx*off)).xy;
conf=texture(uC,cl0(uv+tx*off)).xy;
vel=texture(uA,cl0(uv+sh+tx*off))*sg;
off=(float(i+1)/float(ASTEP))*-uAdvScale*(uAdvVel*vel.xy+uAdvTurb*turb-uAdvConf*conf+uAdvDiv*dv);
dv=diffP(uv+tx*off);
lp=lapV(uv+sh+tx*off)*sg;
adv+=texture(uA,cl0(uv+sh+tx*off))*sg;
dvel+=uVelLap*lp+uVelTurb*turb+uVelConf*conf-uDamp*vel.xy-uDivMin*dv;}
adv/=float(ASTEP);
dvel/=float(ASTEP);
vec2 nv=adv.xy+uVelScale*dvel;
if(uActive>0.5){
vec2 asp=vec2(uSim.x/uSim.y,1.0);
vec2 q=svSeg(uv*asp,uSeg.xy*asp,uSeg.zw*asp);
float g=exp(max(-12.0,-dot(q,q)/(uRadius*uRadius)));
vec2 dir=normz((uSeg.zw-uSeg.xy)*asp);
nv+=uVelScale*uForce*g*dir;}
O=vec4(nv,off);}`
    var FE = HEAD + `uniform sampler2D uA,uE,uPage;
uniform vec4 uSeg;
uniform vec3 uFall,uBase;
uniform float uDye,uInk,uDyeLap,uRadius,uActive,uHasPage,uPageY,uPageS,uPageLod,uShift,uObjK;
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 ab=b-a,ap=p-a;return length(ap-ab*clamp(dot(ap,ab)/max(dot(ab,ab),1e-9),0.0,1.0));}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 tx=1.0/uSim;
vec2 off=texture(uA,uv).zw;
float sy=uv.y+uShift;
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
vec2 sp=cl0(uv+vec2(0.0,uShift)+tx*off);
vec4 e=mix(texture(uE,sp),textureLod(uE,sp,1.0),uDyeLap)*uDye*smoothstep(0.0,sw,uShift<0.0?sy:1.0-sy);
if(uActive>0.5){
vec2 asp=vec2(uSim.x/uSim.y,1.0);
float d=sdSeg(uv*asp,uSeg.xy*asp,uSeg.zw*asp);
float g=exp(max(-12.0,-(d*d)/(uRadius*uRadius)));
float a=g*uInk*(1.0-e.a);
vec3 ink=uFall;
if(uHasPage>0.0){
vec3 pg=textureLod(uPage,clamp(vec2(uv.x,uPageY+(1.0-uv.y)*uPageS),vec2(0.001),vec2(0.999)),uPageLod).rgb;
ink=mix(uFall,pg,clamp(length(pg-uBase)*uObjK,0.0,1.0));}
e.rgb+=ink*a;
e.a+=a;}
O=e;}`
    var FSH = HEAD + `#define STEPS ${STEPS}
uniform sampler2D uA,uP,uE;
uniform float uBump,uTime,uOcc,uGain,uPunch,uFrost,uF0,uThr,uSnap,uWaveSoft,uWaveLod,uEdgeG;
float softmax(float a,float b,float k){return log(exp(k*a)+exp(k*b))/k;}
float softmin(float a,float b,float k){return -log(exp(-k*a)+exp(-k*b))/k;}
float softclamp(float a,float b,float x,float k){return (softmin(b,softmax(a,x,k),k)+softmax(a,softmin(b,x,k),k))/2.0;}
float G1V(float d,float k){return 1.0/(d*(1.0-k)+k);}
float ggx(vec3 n,vec3 v,vec3 l,float rough,float f0){
float a=rough*rough;
vec3 h=normalize(v+l);
float dnl=clamp(dot(n,l),0.0,1.0);
float dnv=clamp(dot(n,v),0.0,1.0);
float dnh=clamp(dot(n,h),0.0,1.0);
float dlh=clamp(dot(l,h),0.0,1.0);
float as=a*a;
float den=dnh*dnh*(as-1.0)+1.0;
float dd=as/(3.14159*den*den);
dlh=pow(1.0-dlh,5.0);
float f=f0+(1.0-f0)*dlh;
return dnl*dd*f*G1V(dnl,a)*G1V(dnv,a);}
float shade(float m,float sp,float oc){
float df=softclamp(0.0,1.0,m+0.5,2.0);
float f=df+4.0*mix(sp,1.5*df*sp,0.3);
f=softclamp(0.0,1.0,4.5*(f-0.5)+0.5,3.0);
return mix(1.0,oc,uOcc)*f;}
float P(vec2 uv,vec2 d,float mip){return -textureLod(uP,cl0(uv+d),mip).x;}
vec2 diffP(vec2 uv,float mip){
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
float dn=P(uv,t.wy,mip),de=P(uv,t.xw,mip);
float ds=P(uv,t.wz,mip),dw=P(uv,-t.xw,mip),dnw=P(uv,-t.xz,mip);
float dsw=P(uv,-t.xy,mip),dne=P(uv,t.xy,mip),dse=P(uv,t.xz,mip);
return vec2(0.5*(de-dw)+0.25*(dne-dnw+dse-dsw),0.5*(dn-ds)+0.25*(dne+dnw-dse-dsw));}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 dxy=vec2(0.0),sd=vec2(0.0);
float occ=0.0,so=0.0,lm=-1.0;
float d0=P(uv,vec2(0.0),0.0);
for(int m=1;m<=STEPS;m++){
float fm=min(float(m),uMaxLod);
if(fm>lm){
lm=fm;
sd=diffP(uv,max(fm-1.0,0.0));
so=softclamp(-2.0,2.0,d0-P(uv,vec2(0.0),fm),1.0);}
dxy+=exp2(-float(m))*sd;
occ+=so/pow(1.5,float(m));}
dxy/=float(STEPS);
occ=pow(max(0.0,softclamp(0.2,0.8,100.0*occ+0.5,1.0)),0.5);
vec3 sp=vec3(uv-0.5,0.0);
vec3 lpos=vec3(cos(uTime*0.5)*0.5,sin(uTime*0.5)*0.5,-0.5);
vec3 ld=normalize(lpos-sp);
vec3 avd=reflect(normalize(vec3(uBump*dxy,-1.0)),vec3(0.0,1.0,0.0));
float fr=uFrost*(1.0-exp(-length(dxy)*uBump*0.03));
float spec=ggx(avd,vec3(0.0,1.0,0.0),ld,0.1+fr*0.55,0.1);
spec=(log(1001.0)/1000.0)*log(1.0+1000.0*spec);
vec4 a=texture(uA,uv);
float f=shade(6.0*uGain*length(a.xy)+fr*0.45,spec,occ);
float ew=max(1.0-uSnap,0.002)*uThr;
vec2 et=uWaveSoft/uSim;
float gate=0.0;
for(int gy=-2;gy<=2;gy++)for(int gx=-2;gx<=2;gx++){
vec2 o=vec2(float(gx),float(gy))*et;
gate+=smoothstep(uThr-ew,uThr+ew,textureLod(uE,uv+o,uWaveLod).a)*float((3-abs(gx))*(3-abs(gy)));}
gate=clamp((gate*0.0123456790-0.5)*uEdgeG+0.5,0.0,1.0);
O=vec4(clamp(abs(f-uF0)*uPunch,0.0,1.0),occ,gate*gate*(3.0-2.0*gate),0.0);}`
    var FPR = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 O;
uniform sampler2D uSH,uE;
uniform vec2 uRes;
uniform float uOpacity,uThr,uBright,uRim,uFrost,uMinL,uBgL;
uniform vec3 uGlass,uLiq;
void main(){
vec2 uv=gl_FragCoord.xy/uRes;
vec4 s=texture(uSH,uv);
vec4 e=texture(uE,uv);
float gate=s.z;
float al=gate*uOpacity*clamp(e.a/uThr,0.0,1.0);
vec3 ecol=mix(uLiq,e.rgb/max(e.a,1e-4),smoothstep(0.0,uThr,e.a));
vec3 col=mix(ecol,uGlass,clamp(4.0*gate*(1.0-gate)*uRim+s.x*s.x*gate*uFrost,0.0,1.0));
float need=clamp((uMinL-(1.0-al)*uBgL)/max(al,1e-4),0.0,1.0);
col=min(col*max(1.0,need/max(dot(col,vec3(0.2126,0.7152,0.0722)),1e-5)),vec3(1.0));
col=mix(col*12.92,1.055*pow(max(col,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),col));
col=min(col*uBright,vec3(1.0));
float dth=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
O=vec4(col+dth,clamp(al+dth*min(1.0,al*255.0),0.0,1.0));}`
    function make(src, type) {
      var s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s))
        return null
      }
      return s
    }
    function link(fsrc) {
      var v = make(VS, gl.VERTEX_SHADER)
      var f = make(fsrc, gl.FRAGMENT_SHADER)
      if (!v || !f) return null
      var p = gl.createProgram()
      gl.attachShader(p, v)
      gl.attachShader(p, f)
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p))
        return null
      }
      return p
    }
    var pB, pC, pD, pA, pE, pS, pR, OK, UB, UC, UD, UA, UE, US, UR, CURP = null
    function use(p) { if (p !== CURP) { gl.useProgram(p); CURP = p } }
    function locs(p, names) {
      var o = {}
      for (const n of names) o[n] = gl.getUniformLocation(p, n)
      return o
    }
    var WSOFT = Math.max(0.5, dnum('liquidWaveSoft', 50))
    var THR = Math.max(0.001, dnum('liquidThreshold', 0.035))
    function boot() {
      if (!gl.getExtension('EXT_color_buffer_float')) return false
      LINEAR = FMT === gl.RGBA16F || !!gl.getExtension('OES_texture_float_linear')
      pB = link(FB); pC = link(FC); pD = link(FD); pA = link(FA); pE = link(FE); pS = link(FSH); pR = link(FPR)
      if (!pR) return false
      OK = !!(pB && pC && pD && pA && pE && pS)
      CURP = null
      gl.bindVertexArray(gl.createVertexArray())
      UB = OK ? locs(pB, ['uA', 'uSim', 'uMaxLod', 'uTurbIso', 'uCurlIso', 'uShift']) : null
      UC = OK ? locs(pC, ['uB', 'uSim', 'uMaxLod', 'uConfIso']) : null
      UD = OK ? locs(pD, ['uA', 'uP', 'uSim', 'uMaxLod', 'uPoisIso', 'uShift']) : null
      UA = OK ? locs(pA, ['uA', 'uB', 'uC', 'uP', 'uSim', 'uMaxLod', 'uSeg', 'uAdvScale', 'uAdvTurb', 'uAdvConf', 'uAdvVel', 'uAdvDiv', 'uVelTurb', 'uVelConf', 'uVelLap', 'uDivMin', 'uDamp', 'uVelScale', 'uForce', 'uRadius', 'uActive', 'uShift']) : null
      UE = OK ? locs(pE, ['uA', 'uE', 'uPage', 'uSim', 'uMaxLod', 'uSeg', 'uDye', 'uInk', 'uDyeLap', 'uRadius', 'uActive', 'uHasPage', 'uFall', 'uBase', 'uObjK', 'uPageY', 'uPageS', 'uPageLod', 'uShift']) : null
      US = OK ? locs(pS, ['uA', 'uP', 'uE', 'uSim', 'uMaxLod', 'uBump', 'uTime', 'uOcc', 'uGain', 'uPunch', 'uFrost', 'uF0', 'uThr', 'uSnap', 'uWaveSoft', 'uWaveLod', 'uEdgeG']) : null
      UR = locs(pR, ['uSH', 'uRes', 'uOpacity', 'uThr', 'uBright', 'uRim', 'uFrost', 'uMinL', 'uBgL', 'uGlass', 'uLiq', 'uE'])
      if (OK) {
        use(pB)
        gl.uniform1i(UB.uA, 0)
        gl.uniform1f(UB.uTurbIso, dnum('liquidTurbIso', 0.9))
        gl.uniform1f(UB.uCurlIso, dnum('liquidCurlIso', 0.6))
        use(pC)
        gl.uniform1i(UC.uB, 1)
        gl.uniform1f(UC.uConfIso, dnum('liquidConfIso', 0.25))
        use(pD)
        gl.uniform1i(UD.uA, 0)
        gl.uniform1i(UD.uP, 3)
        gl.uniform1f(UD.uPoisIso, dnum('liquidPoisIso', 0.15))
        use(pA)
        gl.uniform1i(UA.uA, 0)
        gl.uniform1i(UA.uB, 1)
        gl.uniform1i(UA.uC, 2)
        gl.uniform1i(UA.uP, 3)
        gl.uniform1f(UA.uAdvScale, ADVS)
        gl.uniform1f(UA.uAdvTurb, dnum('liquidAdvTurb', 1))
        gl.uniform1f(UA.uAdvConf, dnum('liquidAdvConf', 0.6))
        gl.uniform1f(UA.uAdvVel, dnum('liquidAdvVel', 0.05))
        gl.uniform1f(UA.uAdvDiv, dnum('liquidAdvDiv', 0))
        gl.uniform1f(UA.uVelTurb, dnum('liquidVelTurb', 0))
        gl.uniform1f(UA.uVelConf, dnum('liquidVelConf', 0))
        gl.uniform1f(UA.uDivMin, dnum('liquidDivMin', 0.1))
        gl.uniform1f(UA.uVelScale, dnum('liquidVelScale', 1))
        gl.uniform1f(UA.uRadius, RAD)
        use(pE)
        gl.uniform1i(UE.uA, 0)
        gl.uniform1i(UE.uE, 5)
        gl.uniform1i(UE.uPage, 6)
        gl.uniform3fv(UE.uFall, BG)
        gl.uniform3fv(UE.uBase, BG)
        gl.uniform1f(UE.uObjK, Math.max(0, dnum('liquidObjectSense', 10)))
        gl.uniform1f(UE.uInk, INK)
        gl.uniform1f(UE.uDyeLap, DYELAP)
        gl.uniform1f(UE.uRadius, RAD)
        use(pS)
        gl.uniform1i(US.uA, 0)
        gl.uniform1i(US.uP, 3)
        gl.uniform1f(US.uBump, dnum('glassBump', 3200))
        var OCC = dnum('glassOcclusion', 0.7)
        var sclamp = function (a, b, x, k) {
          var hi = Math.log(Math.exp(k * a) + Math.exp(k * x)) / k
          var lo = -Math.log(Math.exp(-k * b) + Math.exp(-k * x)) / k
          return (-Math.log(Math.exp(-k * b) + Math.exp(-k * hi)) / k + Math.log(Math.exp(k * a) + Math.exp(k * lo)) / k) / 2
        }
        gl.uniform1f(US.uOcc, OCC)
        gl.uniform1f(US.uF0, (1 - OCC * (1 - Math.sqrt(Math.max(0, sclamp(0.2, 0.8, 0.5, 1))))) * sclamp(0, 1, 4.5 * (sclamp(0, 1, 0.5, 2) - 0.5) + 0.5, 3))
        gl.uniform1f(US.uFrost, dnum('glassFrost', 0.75))
        gl.uniform1f(US.uGain, dnum('liquidGain', 5))
        gl.uniform1f(US.uPunch, dnum('liquidPunch', 2.25))
        gl.uniform1i(US.uE, 5)
        gl.uniform1f(US.uThr, THR)
        gl.uniform1f(US.uSnap, Math.max(0, Math.min(1, dnum('liquidSnap', 0.05))))
        gl.uniform1f(US.uWaveSoft, WSOFT)
        gl.uniform1f(US.uEdgeG, Math.max(1, dnum('liquidEdgeGain', 5)))
      }
      use(pR)
      gl.uniform1i(UR.uSH, 4)
      gl.uniform1i(UR.uE, 5)
      gl.uniform1f(UR.uOpacity, Math.max(0, Math.min(1, dnum('liquidOpacity', 0.5))))
      gl.uniform1f(UR.uBright, Math.max(1, dnum('glassBright', 1)))
      gl.uniform1f(UR.uRim, Math.max(0, Math.min(1, dnum('glassRim', 0.55))))
      gl.uniform1f(UR.uFrost, Math.max(0, Math.min(1, dnum('glassFrostMix', 0.5))))
      gl.uniform3fv(UR.uGlass, tok('--FROST', '#d2d2d2'))
      gl.uniform3fv(UR.uLiq, BG)
      gl.uniform1f(UR.uMinL, MINL)
      gl.uniform1f(UR.uBgL, BGL)
      gl.uniform1f(UR.uThr, THR)
      return true
    }
    var FORCE = Math.max(0, dnum('liquidForce', 0.05))
    var DOVR = DAMPOVR !== null && Number.isFinite(DAMPOVR) ? DAMPOVR : -1
    var LDT = 0, UDYE = 1, UVL = 0, UDMP = 0, UDT = 1, DTD = 1
    var SPDREF = Math.max(0.05, dnum('liquidSpeedRef', 2))
    var ADVS = dnum('liquidAdvScale', 25)
    var SPDRANGE = Math.max(0, dnum('liquidSpeedRange', 0.5))
    var SPDCAP = SPDREF * Math.max(1, dnum('liquidSpeedCap', 3))
    var RAD = Math.max(0.005, dnum('liquidRadius', 0.03))
    var INK = Math.max(0, dnum('liquidInk', 0.45))
    var DYELAP = Math.max(0, Math.min(1, dnum('liquidDyeLap', 0.1)))
    var RADC = RAD, LRA = -1, LRE = -1
    var LADV = -1
    var PAGEY = 0, SHIFT = 0, SPREV = 0
    var SLOCK = /^(1|yes|true|on|page)$/i.test(String(DS.liquidScrollLock || ''))
    var SC = null
    function scrollY() {
      return SC?.getBoundingClientRect().top ?? -(window.scrollY || 0)
    }
    var FMT = /^(1|yes|true|32)$/i.test(String(DS.liquidPrecision || '')) ? gl.RGBA32F : gl.RGBA16F
    var LINEAR = true
    var A0 = null, A1 = null, B = null, C = null, D0 = null, D1 = null, E0 = null, E1 = null, SHT = null
    var simW = 0, simH = 0, LODS = 0
    function target(w, h, mip) {
      var t = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texStorage2D(gl.TEXTURE_2D, mip ? LODS + 1 : 1, FMT, w, h)
      var flat = LINEAR ? gl.LINEAR : gl.NEAREST
      var mips = LINEAR ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? mips : flat)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flat)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      var f = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, f)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return { t: t, f: f, mip: !!mip }
    }
    function wipe(x) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.f)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (x.mip) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, x.t); gl.generateMipmap(gl.TEXTURE_2D) }
    }
    var DPR = dnum('glassDpr', 1.5)
    var vw = 0, vh = 0, ASP = 1
    function scan() { SC = document.getElementById('smooth-content') }
    function pushE() {
      if (!OK) return
      use(pE)
      PAGES = HASPAGE ? Math.min(1, innerHeight / Math.max(DOCH, 1)) : 1
      gl.uniform1f(UE.uPageS, PAGES)
      gl.uniform1f(UE.uHasPage, HASPAGE)
      gl.uniform1f(UE.uPageLod, Math.max(0, PBLUR + Math.log2(Math.max(1, RSC * innerWidth) / Math.max(simW, 1))))
    }
    function resize() {
      var r = Math.min(devicePixelRatio || 1, DPR)
      var w = Math.max(1, Math.round(innerWidth * r))
      var h = Math.max(1, Math.round(innerHeight * r))
      if (w === vw && h === vh) return
      vw = canvas.width = w
      vh = canvas.height = h
      use(pR)
      gl.uniform2f(UR.uRes, w, h)
      if (!OK) return
      var sh = Math.max(64, Math.min(512, Math.round(h / RES)))
      var sw = Math.max(2, Math.round(sh * (w / h)))
      if (sw === simW && sh === simH) return
      simW = sw
      simH = sh
      BND = 1
      ASP = sw / sh
      LODS = Math.floor(Math.log2(Math.max(sw, sh)))
      for (const x of [A0, A1, B, C, D0, D1, E0, E1, SHT]) if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f) }
      A0 = target(sw, sh, 1)
      A1 = target(sw, sh, 1)
      B = target(sw, sh, 1)
      C = target(sw, sh, 0)
      D0 = target(sw, sh, 1)
      D1 = target(sw, sh, 1)
      E0 = target(sw, sh, 1)
      E1 = target(sw, sh, 1)
      SHT = target(sw, sh, 0)
      var ml = Math.min(SCALES - 1, Math.floor(Math.log2(Math.min(sw, sh))))
      for (const q of [[pB, UB], [pC, UC], [pD, UD], [pA, UA], [pE, UE], [pS, US]]) {
        use(q[0])
        gl.uniform2f(q[1].uSim, sw, sh)
        gl.uniform1f(q[1].uMaxLod, ml)
      }
      use(pS)
      gl.uniform1f(US.uWaveLod, Math.max(0, Math.min(LODS, Math.log2(WSOFT))))
    }
    var px = -1, py = -1, QUE = []
    var HOV = Math.max(0, Math.min(1, dnum('liquidHover', 1)))
    var GC = new WeakMap()
    function glassy(t) {
      if (!t || t === document.body) return false
      var v = GC.get(t)
      if (v === undefined) {
        var f = getComputedStyle(t)
        v = (f.backdropFilter && f.backdropFilter !== 'none') || (f.webkitBackdropFilter && f.webkitBackdropFilter !== 'none') ? true : glassy(t.parentElement)
        GC.set(t, v)
      }
      return v
    }
    function seg(x, y) {
      if (px >= 0) {
        var dx = (x - px) * ASP, dy = y - py
        if (dx * dx + dy * dy >= 4e-6 && QUE.length < 256) { QUE.push(px, py, x, y); kick() }
      }
      px = x; py = y
    }
    function move(e) {
      if (HOV < 1 && e.target !== canvas && glassy(e.target)) { px = e.clientX / innerWidth; py = 1 - e.clientY / innerHeight; return }
      var pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null, i
      if (pts?.length) for (i = 0; i < pts.length; i++) seg(pts[i].clientX / innerWidth, 1 - pts[i].clientY / innerHeight)
      else seg(e.clientX / innerWidth, 1 - e.clientY / innerHeight)
    }
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', move, { passive: true })
    function reset() { px = -1; QUE.length = 0 }
    addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') reset() }, { passive: true })
    addEventListener('pointercancel', reset, { passive: true })
    addEventListener('blur', reset, { passive: true })
    document.addEventListener('mouseleave', reset, { passive: true })
    function pass(prog, dst) {
      use(prog)
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (dst.mip) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.generateMipmap(gl.TEXTURE_2D) }
    }
    function bindAll() {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A0.t)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.t)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, C.t)
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, D0.t)
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, E0.t)
      gl.activeTexture(gl.TEXTURE6); if (RTEX) gl.bindTexture(gl.TEXTURE_2D, RTEX)
      BND = 0
    }
    var BND = 1, LPY = -1, LAA = -1, LEA = -1, LCLK = -1
    var HASPAGE = 0
    var PAGES = 1, DOCH = 1
    var RTEX = null, RCV = null, RBUSY = false, RCSS = null, RIMG = new Map()
    var R3E = null, R3X = 0, R3Y = 0, R3C = [], RB = null, R3T = 0, RVW = 0, RVH = 0, RSH = null
    var RS = Math.max(0.05, Math.min(1, dnum('liquidRasterScale', 0.25)))
    var RSC = RS
    var PBLUR = Math.max(0, dnum('liquidColourBlur', 5))
    function dataUrl(b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader()
        fr.onload = function () { res(fr.result) }
        fr.onerror = rej
        fr.readAsDataURL(b)
      })
    }
    function vpFreeze(css) {
      var w = innerWidth / 100, h = innerHeight / 100
      var unit = { vmin: Math.min(w, h), vmax: Math.max(w, h), vw: w, svw: w, dvw: w, lvw: w, vh: h, svh: h, dvh: h, lvh: h }
      var re = /(svh|dvh|lvh|svw|dvw|lvw|vmin|vmax|vh|vw)\b/g, out = '', last = 0, m
      while ((m = re.exec(css)) !== null) {
        var i = m.index, j = i, c = 0
        while (j > last && ((c = css.codePointAt(j - 1)) === 46 || (c > 47 && c < 58))) j--
        if (j === i) continue
        if (j > last && css[j - 1] === '-') j--
        out += css.slice(last, j) + Math.round(Number.parseFloat(css.slice(j, i)) * unit[m[1]] * 100) / 100 + 'px'
        last = re.lastIndex
      }
      return out + css.slice(last)
    }
    function rasterCss() {
      if (RCSS) return Promise.resolve(RCSS)
      return fetch('/styles.css').then(function (r) { return r.text() }).then(function (css) {
        var urls = []
        css.replace(/url\(["']?([^"')]+\.woff2)["']?\)/g, function (_, u) { urls.push(u); return _ })
        return Promise.all(urls.map(function (u) {
          return fetch(u).then(function (r) { return r.blob() }).then(dataUrl).then(function (d) { return [u, d] })
        })).then(function (pairs) {
          for (const p of pairs) css = css.split(p[0]).join(p[1])
          RCSS = css
          return css
        })
      })
    }
    function rasterImgs(clone, cap) {
      var once = new Map()
      return Promise.all(Array.prototype.slice.call(clone.querySelectorAll('img')).map(function (im) {
        var src = im.getAttribute('src')
        if (!src) { im.remove(); return null }
        if (RIMG.has(src)) { im.setAttribute('src', RIMG.get(src)); return null }
        var job = once.get(src)
        if (!job) {
          job = fetch(src).then(function (r) { return r.blob() }).then(createImageBitmap).then(function (bm) {
            var k = Math.min(1, cap / Math.max(bm.width, 1))
            var ic = document.createElement('canvas')
            ic.width = Math.max(1, Math.round(bm.width * k))
            ic.height = Math.max(1, Math.round(bm.height * k))
            var ig = ic.getContext('2d')
            ig.imageSmoothingQuality = 'high'
            ig.drawImage(bm, 0, 0, ic.width, ic.height)
            bm.close()
            var d = ic.toDataURL('image/webp', 0.95)
            RIMG.set(src, d)
            return d
          })
          once.set(src, job)
        }
        return job.then(function (d) { im.setAttribute('src', d) }).catch(function () { im.remove() })
      }))
    }
    function stripInline(clone) {
      for (const n of clone.querySelectorAll('[style]')) {
        var st = n.style
        st.removeProperty('opacity')
        st.removeProperty('filter')
        st.removeProperty('visibility')
        st.removeProperty('transform')
      }
    }
    function stripDom(clone) {
      for (const sel of ['#GL', 'script', 'iframe', 'noscript']) for (const n of clone.querySelectorAll(sel)) n.remove()
      for (const p of clone.querySelectorAll('picture source')) p.remove()
      var cw = clone.querySelector('#smooth-wrapper')
      if (cw) cw.setAttribute('style', 'position:static;height:auto;overflow:visible')
      var cc = clone.querySelector('#smooth-content')
      if (cc) cc.setAttribute('style', 'transform:none;will-change:auto')
    }
    function markers(rn, cwd, chg) {
      var out = []
      for (const o of [[0, 0], [cwd, 0], [0, chg]]) {
        var cm = document.createElement('i')
        cm.style.cssText = 'position:absolute;width:0;height:0;padding:0;margin:0;border:0;left:' + o[0] + 'px;top:' + o[1] + 'px'
        cm.LQ = 1
        rn.appendChild(cm)
        out.push(cm)
      }
      return out
    }
    function facing(rn, root) {
      var am = new DOMMatrix()
      for (var ae = rn; ae && ae !== root; ae = ae.parentElement) {
        var at = getComputedStyle(ae).transform
        if (at !== 'none') am = new DOMMatrix(at).multiply(am)
      }
      return am.m33
    }
    function anchor(rn, cn, pb, rs, W, H) {
      R3E = rn
      R3X = Math.max(0, Math.round(pb.left * rs))
      R3Y = Math.max(0, Math.round((pb.top - (SC?.getBoundingClientRect().top ?? 0)) * rs))
      RB = document.createElement('canvas')
      RB.width = Math.max(1, Math.min(Math.round(W * rs) - R3X, Math.round(rn.offsetWidth * rs)))
      RB.height = Math.max(1, Math.min(Math.round(H * rs) - R3Y, Math.round(rn.offsetHeight * rs)))
      cn.setAttribute('style', 'position:relative;display:block;overflow:hidden;animation:none!important;transform:none!important;width:' + rn.offsetWidth + 'px;height:' + rn.offsetHeight + 'px')
    }
    function project(rn, cn, cs2, root, PX, PY) {
      var cwd = rn.offsetWidth, chg = rn.offsetHeight, ps = rn.style.position, pp = []
      if (cs2.position === 'static') rn.style.position = 'relative'
      var mk = markers(rn, cwd, chg)
      for (const i of mk) {
        var mb = i.getBoundingClientRect()
        pp.push(mb.left - PX, mb.top - PY)
      }
      R3C.push({ e: rn, m: mk, w: cwd, h: chg, bg: cs2.backgroundColor, sy: 0, sw: 0, sh: 0 })
      rn.style.position = ps
      if (cs2.backfaceVisibility === 'hidden' && facing(rn, root) <= 0) { cn.remove(); return }
      cn.setAttribute('style', 'position:absolute;left:0;top:0;animation:none!important;width:' + cwd + 'px;height:' + chg + 'px;transform-origin:0 0!important;transform:matrix(' +
        ((pp[2] - pp[0]) / cwd).toFixed(4) + ',' + ((pp[3] - pp[1]) / cwd).toFixed(4) + ',' + ((pp[4] - pp[0]) / chg).toFixed(4) + ',' +
        ((pp[5] - pp[1]) / chg).toFixed(4) + ',' + Math.round(pp[0]) + ',' + Math.round(pp[1]) + ')')
    }
    function pinAll(clone, rs, W, H) {
      var rall = document.body.querySelectorAll('*')
      var call = clone.querySelectorAll('*')
      var P3 = null, PX = 0, PY = 0
      for (var q = 0; q < call.length && q < rall.length; q++) {
        var rn = rall[q], cn = call[q], cs2 = getComputedStyle(rn)
        var d3 = cs2.transformStyle === 'preserve-3d' || cs2.perspective !== 'none'
        var inp = !!P3?.contains(rn)
        if (d3 && !inp) {
          var pb = rn.getBoundingClientRect()
          P3 = rn; PX = pb.left; PY = pb.top
          anchor(rn, cn, pb, rs, W, H)
        } else if (d3) cn.setAttribute('style', 'position:static!important;display:block;width:0;height:0;animation:none!important;transform:none!important;transform-style:flat!important;perspective:none!important;filter:none!important;will-change:auto!important;contain:none!important')
        else if (inp && cs2.transform !== 'none') project(rn, cn, cs2, P3, PX, PY)
        else if (cn.tagName === 'IMG') cn.setAttribute('style', 'width:' + rn.offsetWidth + 'px;height:' + rn.offsetHeight + 'px;object-fit:cover')
      }
    }
    function flat(el, w, h, y) {
      var node = el.cloneNode(true)
      for (const p of node.querySelectorAll('picture source')) p.remove()
      var ri = el.querySelectorAll('img'), ci = node.querySelectorAll('img')
      for (var q = 0; q < ci.length && q < ri.length; q++) {
        var src = ri[q].currentSrc || ri[q].getAttribute('src')
        if (!RIMG.has(src)) { ci[q].remove(); continue }
        ci[q].setAttribute('src', RIMG.get(src))
        ci[q].setAttribute('style', 'width:' + ri[q].offsetWidth + 'px;height:' + ri[q].offsetHeight + 'px;object-fit:cover')
      }
      stripInline(node)
      node.setAttribute('style', 'position:absolute;left:0;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;margin:0;transform:none;animation:none;opacity:1;filter:none;visibility:visible')
      for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        var wr = p.cloneNode(false)
        wr.setAttribute('style', 'position:static;display:block;margin:0;padding:0;border:0;width:auto;height:auto;transform:none;animation:none;opacity:1;filter:none;overflow:visible;background:none')
        wr.appendChild(node)
        node = wr
      }
      return new XMLSerializer().serializeToString(node)
    }
    function sheet(css, rs) {
      RSH = null
      if (!R3C.length) return
      var w = 0, h = 0, body = ''
      for (const k of R3C) w = Math.max(w, k.w)
      for (const k of R3C) {
        k.sy = Math.round(h * rs); k.sw = Math.round(k.w * rs); k.sh = Math.round(k.h * rs)
        body += flat(k.e, k.w, k.h, h)
        h += k.h
      }
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.max(1, Math.round(w * rs)) + '" height="' + Math.max(1, Math.round(h * rs)) +
        '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;height:' + h + 'px;position:relative;background:' + BGHEX + '"><style>' + css + '</style>' + body + '</div></foreignObject></svg>')
      var im = new Image()
      im.onload = function () { RSH = im }
      im.src = url
    }
    function svgUrl(clone, css, W, H) {
      var html = new XMLSerializer().serializeToString(clone)
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
        '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + W +
        'px;height:' + H + 'px;background:' + BGHEX + '"><style>' + css + '</style>' + html + '</div></foreignObject></svg>')
    }
    function upload(im, W, H, rs) {
      try {
        var cv = RCV || (RCV = document.createElement('canvas'))
        cv.width = Math.max(1, Math.round(W * rs))
        cv.height = Math.max(1, Math.round(H * rs))
        var g2 = cv.getContext('2d')
        g2.imageSmoothingQuality = 'high'
        g2.drawImage(im, 0, 0, cv.width, cv.height)
        if (!RTEX) RTEX = gl.createTexture()
        gl.activeTexture(gl.TEXTURE6)
        gl.bindTexture(gl.TEXTURE_2D, RTEX)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, cv)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        DOCH = H
        RVW = W
        RVH = innerHeight
        RSC = rs
        HASPAGE = 1
        BND = 1
        pushE()
      } catch (e) { HASPAGE = 0; console.error(e) }
      RBUSY = false
    }
    var USEPAGE = !/^(0|no|false|off)$/i.test(String(DS.liquidPageRaster || ''))
    var RLIVE = Math.max(0, dnum('liquidLiveMs', 500))
    var RDIRTY = 0, RLAST = 0
    function buildRaster() {
      if (RBUSY || !USEPAGE) return
      RBUSY = true
      rasterCss().then(vpFreeze).then(function (css) {
        for (const k of R3C) for (const i of k.m) i.remove()
        R3C = []
        R3E = null
        var sc0 = document.getElementById('smooth-content')
        var W = innerWidth
        var H = Math.max(innerHeight, Math.round(sc0?.scrollHeight ?? document.body.scrollHeight))
        var cap = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096
        var rs = Math.min(RS, cap / Math.max(W, H))
        var clone = document.body.cloneNode(true)
        var ro = document.body.querySelectorAll('img'), co = clone.querySelectorAll('img')
        for (var ci = 0; ci < co.length && ci < ro.length; ci++) if (ro[ci].currentSrc) co[ci].setAttribute('src', ro[ci].currentSrc)
        stripInline(clone)
        pinAll(clone, rs, W, H)
        stripDom(clone)
        return rasterImgs(clone, Math.max(1, Math.round(W * rs))).then(function () {
          sheet(css, rs)
          var im = new Image()
          im.onload = function () { upload(im, W, H, rs) }
          im.onerror = function () { RBUSY = false }
          im.src = svgUrl(clone, css, W, H)
        })
      }).catch(function () { RBUSY = false })
    }
    function refresh3D() {
      if (!R3E || !RTEX || !RB || !R3C.length) return
      var rr = R3E.getBoundingClientRect()
      var g3 = RB.getContext('2d')
      g3.setTransform(1, 0, 0, 1, 0, 0)
      g3.fillStyle = BGHEX
      g3.fillRect(0, 0, RB.width, RB.height)
      for (const k of R3C) {
        if (facing(k.e, R3E) <= 0) continue
        var q = k.m.map(function (i) { var b = i.getBoundingClientRect(); return [(b.left - rr.left) * RSC, (b.top - rr.top) * RSC] })
        g3.setTransform((q[1][0] - q[0][0]) / k.w, (q[1][1] - q[0][1]) / k.w, (q[2][0] - q[0][0]) / k.h, (q[2][1] - q[0][1]) / k.h, q[0][0], q[0][1])
        g3.fillStyle = k.bg
        g3.fillRect(0, 0, k.w, k.h)
        if (RSH) g3.drawImage(RSH, 0, k.sy, k.sw, k.sh, 0, 0, k.w, k.h)
      }
      gl.activeTexture(gl.TEXTURE6)
      gl.bindTexture(gl.TEXTURE_2D, RTEX)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, R3X, R3Y, gl.RGBA, gl.UNSIGNED_BYTE, RB)
      gl.generateMipmap(gl.TEXTURE_2D)
    }
    function ours(ns) {
      for (const n of ns) if (!n.LQ) return false
      return true
    }
    function scanDom(recs) {
      for (const r of recs) {
        if (r.type === 'childList' && ours(r.addedNodes) && ours(r.removedNodes)) continue
        if (r.target.LQ || r.target.parentNode?.LQ) continue
        RDIRTY = 1
        return
      }
    }
    var RT = 0
    function rasterSoon() {
      clearTimeout(RT)
      var prev = '', same = 0, tries = 0
      function tick() {
        var doc = innerWidth + 'x' + innerHeight + 'x' + (SC?.scrollHeight ?? 0)
        var v = document.hidden ? '' : doc
        if (v && v === prev) same++; else { same = 0; prev = v }
        if (!document.hidden && (same >= 2 || ++tries > 60)) {
          if (window.requestIdleCallback) requestIdleCallback(buildRaster, { timeout: 500 })
          else buildRaster()
          return
        }
        RT = setTimeout(tick, 100)
      }
      RT = setTimeout(tick, 100)
    }
    var raf = 0, idle = 0, live = false, CLK = 0, prevT = 0
    var SEG = [0, 0, 0, 0], ACT = 0
    function stop() {
      raf = 0
      prevT = 0
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    function kick() {
      if (raf) return
      BND = 1
      prevT = 0
      SPREV = scrollY()
      raf = requestAnimationFrame(frame)
    }
    function timing(now) {
      var DT = prevT ? Math.min(Math.max((now - prevT) / 1000, 1 / 240), 1 / 15) : 1 / FPS
      prevT = now
      if (DT < LDT * 0.99 || DT > LDT * 1.01) {
        LDT = DT
        UDYE = Math.exp(-DT / LIFE)
        UDT = DT * FPS
        UVL = Math.min(0.15, VLAP * DT * FPS)
        UDMP = DOVR >= 0 ? DOVR : 1 - Math.exp(-DT / VTAU)
        DTD = 1
      }
      return DT
    }
    function pushShift(sy) {
      SHIFT = Math.max(-0.5, Math.min(0.5, (sy - SPREV) / Math.max(innerHeight, 1)))
      use(pB); gl.uniform1f(UB.uShift, SHIFT)
      use(pD); gl.uniform1f(UD.uShift, SHIFT)
      use(pA); gl.uniform1f(UA.uShift, SHIFT)
      use(pE); gl.uniform1f(UE.uShift, SHIFT)
    }
    function stroke(DT) {
      var nq = QUE.length >> 2
      if (!nq) return 0
      var tot = 0
      for (var k = 0; k < nq; k++) {
        var ex = (QUE[k * 4 + 2] - QUE[k * 4]) * ASP, ey = QUE[k * 4 + 3] - QUE[k * 4 + 1]
        tot += Math.hypot(ex, ey)
      }
      SEG[0] = QUE[0]; SEG[1] = QUE[1]
      SEG[2] = QUE[nq * 4 - 2]; SEG[3] = QUE[nq * 4 - 1]
      var spd = Math.min(tot / DT, SPDCAP) / SPDREF
      var kick = 1 + SPDRANGE * Math.max(0, spd - 1)
      var adv = ADVS * kick * UDT
      RADC = RAD * kick
      gl.uniform4f(UA.uSeg, SEG[0], SEG[1], SEG[2], SEG[3])
      gl.uniform1f(UA.uForce, FORCE * spd * UDT)
      if (adv !== LADV) { gl.uniform1f(UA.uAdvScale, adv); LADV = adv }
      if (RADC !== LRA) { gl.uniform1f(UA.uRadius, RADC); LRA = RADC }
      return 1
    }
    function sim(DT) {
      gl.viewport(0, 0, simW, simH)
      if (BND) bindAll()
      pass(pB, B)
      pass(pC, C)
      pass(pD, D1)
      var sd = D0; D0 = D1; D1 = sd
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, D0.t)
      use(pA)
      ACT = stroke(DT)
      if (ACT !== LAA) { gl.uniform1f(UA.uActive, ACT); LAA = ACT }
      if (DTD) { gl.uniform1f(UA.uVelLap, UVL); gl.uniform1f(UA.uDamp, UDMP) }
      pass(pA, A1)
      var sa = A0; A0 = A1; A1 = sa
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A0.t)
      use(pE)
      if (RADC !== LRE) { gl.uniform1f(UE.uRadius, RADC); LRE = RADC }
      if (DTD) { gl.uniform1f(UE.uDye, UDYE); gl.uniform1f(UE.uInk, INK * UDT); gl.uniform1f(UE.uDyeLap, Math.min(1, DYELAP * UDT)); DTD = 0 }
      if (PAGEY !== LPY) { gl.uniform1f(UE.uPageY, PAGEY); LPY = PAGEY }
      if (ACT !== LEA) { gl.uniform1f(UE.uActive, ACT); LEA = ACT }
      if (ACT) gl.uniform4f(UE.uSeg, SEG[0], SEG[1], SEG[2], SEG[3])
      pass(pE, E1)
      var se = E0; E0 = E1; E1 = se
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, E0.t)
      use(pS)
      if (CLK !== LCLK) { gl.uniform1f(US.uTime, CLK); LCLK = CLK }
      pass(pS, SHT)
      QUE.length = 0
      use(pR)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, SHT.t)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    function frame(now) {
      var DT = timing(now)
      if (QUE.length) { idle = 0; live = true; CLK += DT }
      if (!(OK && A0 && live)) return stop()
      var sy = HASPAGE || SLOCK ? scrollY() : 0
      if (SLOCK) pushShift(sy)
      SPREV = sy
      PAGEY = HASPAGE ? Math.max(0, Math.min(1 - PAGES, -sy / Math.max(DOCH, 1))) : 0
      if (idle > QUIET) {
        for (const x of [A0, A1, B, C, D0, D1, E0, E1, SHT]) wipe(x)
        live = false
        return stop()
      }
      idle += DT
      if (R3C.length && now - R3T > 250) { R3T = now; refresh3D() }
      if (RDIRTY && HASPAGE && !RBUSY && idle * 1000 > RLIVE && now - RLAST > RLIVE) { RLAST = now; RDIRTY = 0; buildRaster() }
      sim(DT)
      raf = requestAnimationFrame(frame)
    }
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault()
      cancelAnimationFrame(raf)
      raf = 0
      live = false
      RBUSY = false
    })
    canvas.addEventListener('webglcontextrestored', function () {
      A0 = A1 = B = C = D0 = D1 = E0 = E1 = SHT = null
      RTEX = null
      HASPAGE = 0
      R3E = null
      R3C = []
      RSH = null
      RDIRTY = 0
      vw = vh = simW = simH = 0
      LDT = 0
      DTD = 1
      LPY = LAA = LEA = LCLK = LADV = LRA = LRE = -1
      if (!boot()) return
      scan()
      resize()
      pushE()
      kick()
      rasterSoon()
    })
    addEventListener('resize', function () {
      var big = innerWidth !== RVW || Math.abs(innerHeight - RVH) >= 120
      if (big) { HASPAGE = 0; scan() }
      resize(); pushE(); kick()
      if (big) rasterSoon()
    })
    addEventListener('orientationchange', resize)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else kick()
    })
    if (!boot()) return
    scan()
    resize()
    pushE()
    if (RLIVE && USEPAGE) new MutationObserver(scanDom).observe(document.body, { subtree: true, childList: true, characterData: true, attributeFilter: ['class'] })
    if (document.readyState === 'complete') rasterSoon()
    else addEventListener('load', rasterSoon, { once: true })
    raf = requestAnimationFrame(frame)
  })()
  ; (function () {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return
    var all = function (r, s) { return [...r.querySelectorAll(s)] }
    var TEXT = 'h1, h2, h3, p, cite'
    var SLIDES =
      '#HOME section:nth-of-type(1), .SCENE, .QUOTE, #OFFERS section, #PROFILE'
    var RANK = { H1: 0, H2: 1, H3: 2, P: 3, CITE: 4 }
    var DUR = 0.95
    var EASE = 'expo.out'
    var BLUR = 10
    var STEP = 0.05
    var SIB = 0.1
    var LINE = 0.15
    var WORD = 0.05
    var HOLD = 2.5
    var SCRD = 0.8
    var HOVD = 0.4
    var SCRUB = 0.6
    var START = 'top bottom'
    var QSPAN = 1
    var GLYPH = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
    var SYN = {
      remember: ['recall', 'think of first'],
      call: ['pick up', 'reach for'],
      'figure out': ['decode', 'work out'],
      'choose someone else': ['look elsewhere', 'pick the safer name'],
      'that sells for you': ['that does the selling', 'that argues your case'],
      'that holds up': ['that travels', 'that scales with you'],
      'that close': ['that convert', 'that earn the call'],
      'hands only': ['people only', 'minds only'],
      'at it': ['in it', 'on the tools'],
      shipped: ['delivered', 'live'],
      compared: ['weighed up', 'shortlisted'],
      chosen: ['picked', 'booked']
    }
    var soft = matchMedia('(prefers-reduced-motion: reduce)').matches
    var mob = matchMedia('(max-width: 768px)').matches
    var RISE = soft ? 10 : 30
    var LIFT = soft ? 10 : 25
    var FROM = { opacity: 0, y: LIFT }
    var TO = { opacity: 1, y: 0, clearProps: 'all' }
    if (!mob) {
      FROM.filter = 'blur(' + BLUR + 'px)'
      TO.filter = 'blur(0px)'
    }
    var WOKE = false, WAKE = []
    function wake() {
      if (WOKE) return
      WOKE = true
      for (const f of WAKE) f()
      WAKE.length = 0
    }
    for (const e of ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'keydown']) addEventListener(e, wake, { passive: true, once: true })
    function chunk(n, out) {
      var f = document.createDocumentFragment()
      for (const part of n.nodeValue.split(/(\s+)/)) {
        if (!part) continue
        if (part.trim()) {
          var sp = document.createElement('span')
          sp.className = 'W'
          sp.textContent = part
          f.appendChild(sp)
          out.push(sp)
        } else f.appendChild(document.createTextNode(part))
      }
      n.parentNode.replaceChild(f, n)
    }
    function words(el) {
      var out = [],
        nodes = [],
        w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) nodes.push(w.currentNode)
      for (const n of nodes) {
        var mk = n.parentElement.closest('mark[outline]')
        if (mk) {
          if (out.at(-1) !== mk) out.push(mk)
        } else if (n.nodeValue.trim()) chunk(n, out)
      }
      return out
    }
    function lines(ws) {
      var ln = [], pos = [], top = -1e9, n = -1, k = 0
      for (const w of ws) {
        var r = w.getBoundingClientRect()
        if (r.top > top + r.height * 0.5) {
          n++
          k = 0
          top = r.top
        }
        ln.push(n)
        pos.push(k++)
      }
      return { ln: ln, pos: pos }
    }
    function bl(n) { return mob ? {} : { filter: 'blur(' + n + 'px)' } }
    var CVX = document.createElement('canvas').getContext('2d')
    function gauge(el, txt, w) {
      var cs = getComputedStyle(el), f = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
      CVX.font = f
      return { f: f, s: txt.length ? (w - CVX.measureText(txt).width) / txt.length : 0, w: w }
    }
    function cw(m, s) {
      CVX.font = m.f
      return CVX.measureText(s).width + s.length * m.s
    }
    var POOL = new Uint8Array(500), pick = POOL.length
    function glyph() {
      if (pick >= POOL.length) {
        crypto.getRandomValues(POOL)
        pick = 0
      }
      return GLYPH.charAt(POOL[pick++] % GLYPH.length)
    }
    function mix(a, b, p, m) {
      var L = Math.round(a.length + (b.length - a.length) * p)
      var lock = Math.min(L, Math.floor(b.length * Math.max(0, (p - 0.4) / 0.6)))
      var keep = Math.max(0, Math.min(a.length - Math.ceil(a.length * Math.min(1, p / 0.4)), L - lock))
      var head = b.slice(0, lock), tail = keep ? a.slice(a.length - keep) : '', g = ''
      var A = cw(m, a), T = Math.min(m.w, A + (cw(m, b) - A) * p)
      for (var i = Math.max(0, L - lock - keep); i > 0 && cw(m, head + g + tail) < T; i--) g += glyph()
      while (g && cw(m, head + g + tail) > T) g = g.slice(0, -1)
      return head + g + tail
    }
    function hover(el) {
      var units = all(el, '.W')
      if (!units.length) units = [el]
      for (const u of units) u.LQ = 1
      var busy = false
      el.addEventListener('mouseenter', function () {
        if (busy) return
        busy = true
        var done = 0
        units.forEach(function (u, i) {
          var raw = u.textContent, lead = raw.slice(0, raw.length - raw.trimStart().length), tail = raw.slice(raw.trimEnd().length)
          var txt = raw.slice(lead.length, raw.length - tail.length), pr = { v: 0 }
          var tn = u.firstChild, rg = document.createRange()
          if (tn?.nodeType === 3 && u.childNodes.length === 1) {
            rg.setStart(tn, lead.length)
            rg.setEnd(tn, lead.length + txt.length)
          } else rg.selectNodeContents(u)
          var m = gauge(u, txt, rg.getBoundingClientRect().width)
          u.style.boxSizing = 'border-box'
          u.style.width = u.getBoundingClientRect().width + 'px'
          u.style.whiteSpace = 'nowrap'
          gsap.fromTo(pr, { v: 0 }, {
            v: 1,
            duration: HOVD,
            ease: 'none',
            delay: i * WORD,
            onUpdate: function () { u.textContent = lead + mix(txt, txt, pr.v, m) + tail },
            onComplete: function () {
              u.textContent = raw
              u.style.removeProperty('width')
              u.style.removeProperty('white-space')
              u.style.removeProperty('box-sizing')
              if (++done === units.length) busy = false
            }
          })
        })
        if (!mob) gsap.fromTo(el, { filter: 'blur(0px)' }, { filter: 'blur(' + BLUR / 5 + 'px)', duration: HOVD / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, onComplete: function () { el.style.removeProperty('filter') } })
      })
    }
    var SLOTS = []
    function slot(mk, seq, cur) {
      var w = 0, t0 = seq[0]
      for (const t of seq) {
        mk.textContent = t
        var r = mk.getBoundingClientRect().width
        if (r > w) {
          w = r
          t0 = t
        }
      }
      mk.M = gauge(mk, t0, w)
      mk.WIDE = t0
      mk.textContent = cur
      mk.setAttribute('outline', cur)
    }
    function span(mk, t) {
      var was = mk.textContent, pin = mk.style.width
      mk.style.removeProperty('width')
      mk.textContent = t
      var w = mk.getBoundingClientRect().width
      mk.textContent = was
      if (pin) mk.style.width = pin
      return w
    }
    function tally(s) {
      var el = s.t[0], was = el.textContent
      el.style.removeProperty('min-width')
      el.textContent = s.pre + '9'.repeat(String(s.end).length)
      el.style.minWidth = el.getBoundingClientRect().width + 'px'
      el.textContent = was
    }
    function reserve(P) {
      if (!P) return
      var ms = all(P, 'mark'), was = ms.map(function (m) { return m.textContent })
      P.style.removeProperty('min-width')
      ms.forEach(function (m, i) { m.textContent = m.WIDE || was[i] })
      var w = P.getBoundingClientRect().width
      ms.forEach(function (m, i) { m.textContent = was[i] })
      P.style.minWidth = w + 'px'
    }
    addEventListener('resize', function () {
      for (const s of SLOTS) {
        slot(s.mk, s.seq, s.mk.textContent)
        reserve(s.P)
      }
      for (const s of sets) if (s.end !== undefined) tally(s)
    }, { passive: true })
    function swap(mk) {
      var seq = [mk.textContent.trim()]
      seq = seq.concat(SYN[seq[0].toLowerCase()] || [])
      var n = 0
      mk.LQ = 1
      if (seq.length < 2) return
      var pr = { v: 0 }, from = seq[0], to = seq[0]
      var solo = !!mk.closest('.QUOTE'), lit = false
      var P = mk.closest('h1,h2,h3,p')
      var tl = gsap.timeline({ scrollTrigger: { trigger: mk, start: START, end: 'bottom top', toggleActions: 'play pause resume pause' } })
      tl.call(function () {
        document.fonts.ready.then(function () {
          SLOTS.push({ mk: mk, seq: seq, P: P })
          slot(mk, seq, seq[n])
          reserve(P)
        })
      })
      function build() {
        var loop = gsap.timeline({
          repeat: -1,
          repeatDelay: HOLD,
          repeatRefresh: true,
          delay: HOLD,
          scrollTrigger: { trigger: mk, start: START, end: 'bottom top', toggleActions: 'play pause resume pause' }
        })
        loop.call(function () {
          from = seq[n]
          n = (n + 1) % seq.length
          to = seq[n]
          if (!mob && !lit) {
            lit = solo
            gsap.fromTo(mk, { filter: 'blur(0px)' }, { filter: 'blur(' + BLUR / 2 + 'px)', duration: SCRD / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, onComplete: function () { mk.style.removeProperty('filter') } })
          }
        })
        loop.fromTo(pr, { v: 0 }, {
          v: 1,
          duration: SCRD,
          ease: 'none',
          immediateRender: false,
          onUpdate: function () {
            if (!mk.M) return
            var s = mix(from, to, pr.v, mk.M)
            mk.textContent = s
            mk.setAttribute('outline', s)
          },
          onComplete: function () {
            mk.textContent = to
            mk.setAttribute('outline', to)
          }
        })
        loop.fromTo(mk, { width: function () { return span(mk, from) } }, {
          width: function () { return span(mk, to) },
          duration: SCRD,
          ease: 'none',
          immediateRender: false,
          clearProps: 'width'
        }, '<')
      }
      if (WOKE) build()
      else WAKE.push(build)
    }
    function sib(el) {
      var n = 0,
        p = el.parentElement
      if (!p) return 0
      for (const ch of p.children) {
        if (ch === el) break
        if (ch.tagName === el.tagName) n++
      }
      return n
    }
    function trig(el) {
      return { trigger: el, start: START, once: true }
    }
    var sets = all(document, TEXT)
      .filter(function (t) {
        return !t.closest('nav') && !t.closest('.CARD')
      })
      .map(function (t) {
        var raw = t.textContent.trim(),
          s = { el: t, at: (RANK[t.tagName] || 0) * STEP + sib(t) * SIB }
        if (t.tagName === 'P' && /^\+?\d+$/.test(raw)) {
          s.pre = raw.charAt(0) === '+' ? '+' : ''
          s.end = Number.parseInt(raw, 10)
          s.t = [t]
          tally(s)
          t.textContent = s.pre + '0'
        } else s.t = words(t)
        return s
      })
    sets.forEach(function (s) {
      gsap.set(s.t, FROM)
    })
    all(document, SLIDES).forEach(function (b) {
      var deep = !b.classList.contains('SCENE')
      gsap.fromTo(
        b,
        { y: RISE, opacity: 0, ...(deep ? bl(BLUR) : {}) },
        {
          y: 0,
          opacity: 1,
          ...(deep ? bl(0) : {}),
          duration: DUR,
          ease: EASE,
          delay: sib(b) * SIB,
          clearProps: 'all',
          scrollTrigger: trig(b)
        }
      )
    })
    all(document, 'mark[outline]').forEach(function (m) { swap(m) })
    all(document, 'a, button').forEach(function (el) { hover(el) })
    var navKids = all(document, 'nav > a, nav > button')
    if (navKids.length)
      gsap.fromTo(navKids, FROM, {
        ...TO,
        duration: DUR,
        ease: EASE,
        delay: 0.15,
        stagger: 0.1
      })
    document.fonts.ready.then(function () {
      sets.forEach(function (s) {
        if (!s.t.length) return
        var q = !!s.el.closest('.QUOTE'),
          tw,
          L = lines(s.t),
          v = {
            opacity: 1,
            y: 0,
            ...bl(0),
            duration: DUR,
            ease: q ? 'none' : EASE,
            delay: q ? 0 : s.at,
            stagger: function (i) {
              return L.ln[i] * LINE + L.pos[i] * WORD
            },
            scrollTrigger: q ? { trigger: s.el, start: START, end: function (self) { return Math.min(self.start + innerHeight * QSPAN, ScrollTrigger.maxScroll(window)) }, scrub: SCRUB } : trig(s.el)
          }
        if (!q) v.clearProps = s.end === undefined ? 'all' : 'opacity,transform,filter'
        if (s.end !== undefined) {
          tally(s)
          v.onUpdate = function () {
            if (tw) s.el.textContent = s.pre + Math.round(tw.ratio * s.end)
          }
        }
        tw = gsap.fromTo(s.t, FROM, v)
      })
      ScrollTrigger.refresh()
    })
    var smoother = ScrollSmoother.get()
    if (smoother) for (const a of document.querySelectorAll('nav a[href^="#"]')) {
      a.addEventListener('click', function (e) {
        var t = document.querySelector(this.getAttribute('href'))
        if (!t) return
        e.preventDefault()
        var nb = this.closest('nav').getBoundingClientRect().bottom
        smoother.scrollTo(Math.max(0, smoother.offset(t, 'top top') - nb), true)
      })
    }
  })()
  ; (function (C, A, L) {
    let p = function (a, ar) {
      a.q.push(ar)
    }
    let d = C.document
    C.Cal =
      C.Cal ||
      function () {
        let cal = C.Cal
        let ar = arguments
        if (!cal.loaded) {
          cal.ns = {}
          cal.q = cal.q || []
          d.head.appendChild(d.createElement('script')).src = A
          cal.loaded = true
        }
        if (ar[0] === L) {
          const api = function () {
            p(api, arguments)
          }
          const namespace = ar[1]
          api.q = api.q || []
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api
            p(cal.ns[namespace], ar)
            p(cal, ['initNamespace', namespace])
          } else p(cal, ar)
          return
        }
        p(cal, ar)
      }
  })(window, 'https://app.cal.com/embed/embed.js', 'init')
function book(fire) {
  if (!book.p) {
    Cal('init', 'booking', { origin: 'https://app.cal.com' })
    Cal.config = Cal.config || {}
    Cal.config.forwardQueryParams = true
    Cal.ns.booking('ui', {
      theme: 'light',
      cssVarsPerTheme: {
        light: { 'cal-brand': '#e0e0e0' },
        dark: { 'cal-brand': '#000' }
      },
      hideEventTypeDetails: false,
      layout: 'month_view'
    })
    var js = document.head.querySelector('script[src^="https://app.cal.com/embed"]')
    book.p = js ? new Promise(function (ok) { js.addEventListener('load', ok, { once: true }) }) : Promise.resolve()
    book.p.then(function () { book.up = 1 })
  }
  if (fire) book.p.then(function () { requestAnimationFrame(function () { fire.click() }) })
}
for (const bt of document.querySelectorAll('[data-cal-link]')) {
  for (const ev of ['pointerenter', 'focus', 'touchstart']) bt.addEventListener(ev, function () { book() }, { passive: true, once: true })
  bt.addEventListener('click', function (e) {
    if (book.up) return
    e.preventDefault()
    book(this)
  })
}