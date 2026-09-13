gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
ScrollSmoother.get() || ScrollSmoother.create({ smooth: 1.25, smoothTouch: .125, normalizeScroll: true, ignoreMobileResize: true });
'use strict'
  ; (function () {
    var canvas = document.getElementById('GL')
    var gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return
    if (!gl.getExtension('EXT_color_buffer_float')) return
    var DS = { ...document.body.dataset }
    new URLSearchParams(location.search).forEach(function (v, k) {
      DS[k.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase() })] = v
    })
    var dnum = function (k, f) {
      var v = parseFloat(DS[k])
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
      var n = parseInt(h, 16)
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (c) {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
    }
    var tok = function (n, f) { return rgb(HEX(CSSV.getPropertyValue(n), f)) }
    var LN = tok('--LIQUID', '#c5c5c5')
    var luma = function (c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    var BGL = luma(tok('--BACKGROUND', '#e0e0e0'))
    var TXL = luma(tok('--COLOR', '#000'))
    var MINL = TXL < BGL ? Math.min(1, Math.max(0, Math.max(1, dnum('liquidTextContrast', 7)) * (TXL + 0.05) - 0.05 + 0.005)) : 0
    var LAYER = /^(1|top|over|front)$/i.test(String(DS.liquidLayer || '')) ? 1 : 0
    canvas.style.zIndex = LAYER ? '30' : '0'
    canvas.style.mixBlendMode = 'normal'
    canvas.style.pointerEvents = LAYER ? 'none' : 'auto'
    var RES = Math.max(1, dnum('liquidRes', 4))
    var SCALES = Math.max(1, Math.min(12, Math.round(dnum('liquidScales', 11))))
    var ASTEP = Math.max(1, Math.min(8, Math.round(dnum('liquidAdvSteps', 3))))
    var STEPS = Math.max(1, Math.min(12, Math.round(dnum('glassSteps', 10))))
    var QUIET = Math.max(0.1, dnum('liquidQuiet', 5.5))
    var FPS = 60
    var LIFE = Math.max(0.05, dnum('liquidSmearLife', 1.6))
    var VTAU = Math.max(0.05, dnum('liquidVelLife', 0.6))
    var VLAP = Math.max(0, dnum('liquidVelLap', 0.02))
    var DAMPOVR = DS.liquidDamp !== undefined ? parseFloat(DS.liquidDamp) : null
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
vec2 v=vec2(0.0);
float curl=0.0,tw=0.0,cw=0.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
vec2 d=textureLod(uA,cl0(uv+t.ww),mip).xy;
vec2 dn=textureLod(uA,cl0(uv+t.wy),mip).xy;
vec2 de=textureLod(uA,cl0(uv+t.xw),mip).xy;
vec2 ds=textureLod(uA,cl0(uv+t.wz),mip).xy;
vec2 dw=textureLod(uA,cl0(uv-t.xw),mip).xy;
vec2 dnw=textureLod(uA,cl0(uv-t.xz),mip).xy;
vec2 dsw=textureLod(uA,cl0(uv-t.xy),mip).xy;
vec2 dne=textureLod(uA,cl0(uv+t.xy),mip).xy;
vec2 dse=textureLod(uA,cl0(uv+t.xz),mip).xy;
mat3 mx=mat3(dnw.x,dn.x,dne.x,dw.x,d.x,de.x,dsw.x,ds.x,dse.x);
mat3 my=mat3(dnw.y,dn.y,dne.y,dw.y,d.y,de.y,dsw.y,ds.y,dse.y);
float twf=1.0;
float cwf=1.0/float(i+1);
v+=twf*vec2(reduce(txx,mx)+reduce(txy,my),reduce(tyy,my)+reduce(txy,mx));
curl+=cwf*(reduce(cx,mx)+reduce(cy,my));
tw+=twf;
cw+=cwf;}
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
O=vec4(float(SCALES)*v/tw,0.0,nrm*curl/cw)*smoothstep(0.0,sw,uShift<0.0?uv.y:1.0-uv.y);}`
    var FC = HEAD + `#define SCALES ${SCALES}
uniform sampler2D uB;
uniform float uConfIso;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
float k0=uConfIso,k1=1.0-2.0*uConfIso;
mat3 cx=mat3(-k0,-k1,-k0,0.0,0.0,0.0,k0,k1,k0);
mat3 cy=mat3(-k0,0.0,k0,-k1,0.0,k1,-k0,0.0,k0);
vec2 v=vec2(0.0);
float wc=0.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
float d=abs(textureLod(uB,cl0(uv+t.ww),mip).w);
float dn=abs(textureLod(uB,cl0(uv+t.wy),mip).w);
float de=abs(textureLod(uB,cl0(uv+t.xw),mip).w);
float ds=abs(textureLod(uB,cl0(uv+t.wz),mip).w);
float dw=abs(textureLod(uB,cl0(uv-t.xw),mip).w);
float dnw=abs(textureLod(uB,cl0(uv-t.xz),mip).w);
float dsw=abs(textureLod(uB,cl0(uv-t.xy),mip).w);
float dne=abs(textureLod(uB,cl0(uv+t.xy),mip).w);
float dse=abs(textureLod(uB,cl0(uv+t.xz),mip).w);
mat3 mc=mat3(dnw,dn,dne,dw,d,de,dsw,ds,dse);
float curl=textureLod(uB,cl0(uv+t.ww),mip).w;
v+=curl*normz(vec2(reduce(cx,mc),reduce(cy,mc)));
wc+=1.0;}
O=vec4(v/wc,0.0,0.0);}`
    var FD = HEAD + `#define SCALES ${SCALES}
uniform sampler2D uA,uP;
uniform float uPoisIso,uShift;
void main(){
vec2 uv=gl_FragCoord.xy/uSim+vec2(0.0,uShift);
float k0=uPoisIso,k1=1.0-2.0*uPoisIso;
mat3 px=mat3(k0,0.0,-k0,k1,0.0,-k1,k0,0.0,-k0);
mat3 py=mat3(-k0,-k1,-k0,0.0,0.0,0.0,k0,k1,k0);
mat3 gs=mat3(0.0625,0.125,0.0625,0.125,0.25,0.125,0.0625,0.125,0.0625);
vec2 v=vec2(0.0);
float wc=0.0;
for(int i=0;i<SCALES;i++){
float mip=min(float(i),uMaxLod);
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
vec2 d=textureLod(uA,cl0(uv+t.ww),mip).xy;
vec2 dn=textureLod(uA,cl0(uv+t.wy),mip).xy;
vec2 de=textureLod(uA,cl0(uv+t.xw),mip).xy;
vec2 ds=textureLod(uA,cl0(uv+t.wz),mip).xy;
vec2 dw=textureLod(uA,cl0(uv-t.xw),mip).xy;
vec2 dnw=textureLod(uA,cl0(uv-t.xz),mip).xy;
vec2 dsw=textureLod(uA,cl0(uv-t.xy),mip).xy;
vec2 dne=textureLod(uA,cl0(uv+t.xy),mip).xy;
vec2 dse=textureLod(uA,cl0(uv+t.xz),mip).xy;
float p=textureLod(uP,cl0(uv+t.ww),mip).x;
float pn=textureLod(uP,cl0(uv+t.wy),mip).x;
float pe=textureLod(uP,cl0(uv+t.xw),mip).x;
float ps=textureLod(uP,cl0(uv+t.wz),mip).x;
float pw=textureLod(uP,cl0(uv-t.xw),mip).x;
float pnw=textureLod(uP,cl0(uv-t.xz),mip).x;
float psw=textureLod(uP,cl0(uv-t.xy),mip).x;
float pne=textureLod(uP,cl0(uv+t.xy),mip).x;
float pse=textureLod(uP,cl0(uv+t.xz),mip).x;
mat3 mx=mat3(dnw.x,dn.x,dne.x,dw.x,d.x,de.x,dsw.x,ds.x,dse.x);
mat3 my=mat3(dnw.y,dn.y,dne.y,dw.y,d.y,de.y,dsw.y,ds.y,dse.y);
mat3 mp=mat3(pnw,pn,pne,pw,p,pe,psw,ps,pse);
float w=1.0/float(i+1);
wc+=w;
v+=w*vec2(reduce(px,mx)+reduce(py,my),reduce(gs,mp));}
v/=wc;
vec2 t0=1.0/uSim;
vec4 q0=vec4(t0,-t0.y,0.0);
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
uniform vec4 uORect[64];
uniform vec3 uOCol[64];
uniform float uDye,uInk,uRadius,uActive,uPickup,uHasPage,uPageY,uPageS,uShift,uObjK,uONR,uORad,uOSoft,uReflK,uReflA,uReflH;
uniform vec2 uCanv;
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 ab=b-a,ap=p-a;return length(ap-ab*clamp(dot(ap,ab)/max(dot(ab,ab),1e-9),0.0,1.0));}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 tx=1.0/uSim;
vec2 off=texture(uA,uv).zw;
float sy=uv.y+uShift;
float sw=clamp(abs(uShift)*2.0,0.004,0.08);
vec4 e=texture(uE,cl0(uv+vec2(0.0,uShift)+tx*off))*uDye*smoothstep(0.0,sw,uShift<0.0?sy:1.0-sy);
if(uHasPage>0.0&&e.a>1e-4){
vec3 cur=e.rgb/e.a;
vec2 pv=uv+texture(uA,uv).xy*uReflK;
vec3 pg=texture(uPage,clamp(vec2(pv.x,uPageY+(1.0-pv.y)*uPageS),vec2(0.001),vec2(0.999))).rgb;
float ob=clamp(length(pg-uBase)*uObjK,0.0,1.0);
vec3 tgt=mix(uFall,pg,ob);
if(uONR>0.5){
vec2 fc=pv*uCanv;
float dm=1e9;
vec3 ec=uFall;
for(int i=0;i<64;i++){
if(float(i)>=uONR)break;
vec2 qq=abs(fc-uORect[i].xy)-uORect[i].zw+uORad;
float d2=min(max(qq.x,qq.y),0.0)+length(max(qq,vec2(0.0)))-uORad;
if(d2<dm){dm=d2;ec=uOCol[i];}}
tgt=mix(tgt,ec,clamp((1.0-smoothstep(-uOSoft,uOSoft,dm))*mix(1.0,1.0-ob,uReflH)*uReflA,0.0,1.0));}
e.rgb=mix(cur,tgt,uPickup*uHasPage)*e.a;}
if(uActive>0.5){
vec2 asp=vec2(uSim.x/uSim.y,1.0);
float d=sdSeg(uv*asp,uSeg.xy*asp,uSeg.zw*asp);
float g=exp(max(-12.0,-(d*d)/(uRadius*uRadius)));
float a=g*uInk*(1.0-e.a);
e.rgb+=uFall*a;
e.a+=a;}
O=e;}`
    var FSH = HEAD + `#define STEPS ${STEPS}
uniform sampler2D uA,uP;
uniform float uBump,uTime,uOcc,uGain,uPunch,uFrost;
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
vec2 dxy=vec2(0.0);
float occ=0.0;
float d0=P(uv,vec2(0.0),0.0);
for(int m=1;m<=STEPS;m++){
float fm=min(float(m),uMaxLod);
dxy+=(1.0/pow(2.0,float(m)))*diffP(uv,max(fm-1.0,0.0));
occ+=softclamp(-2.0,2.0,d0-P(uv,vec2(0.0),fm),1.0)/pow(1.5,float(m));}
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
float f0=shade(0.0,0.0,pow(max(0.0,softclamp(0.2,0.8,0.5,1.0)),0.5));
O=vec4(clamp(abs(f-f0)*uPunch,0.0,1.0),occ,0.0,0.0);}`
    var FPR = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 O;
uniform sampler2D uSH,uE;
uniform vec2 uRes,uSim;
uniform float uOpacity,uThr,uSnap,uWaveSoft,uWaveLod,uBright,uRim,uFrost,uEdgeG,uMinL,uBgL;
uniform vec3 uGlass,uLiq;
void main(){
vec2 uv=gl_FragCoord.xy/uRes;
vec4 s=texture(uSH,uv);
vec4 e=texture(uE,uv);
float ew=max(1.0-uSnap,0.002)*uThr;
vec2 et=uWaveSoft/uSim;
float gate=0.0;
for(int gy=-2;gy<=2;gy++)for(int gx=-2;gx<=2;gx++){
vec2 o=vec2(float(gx),float(gy))*et;
gate+=smoothstep(uThr-ew,uThr+ew,textureLod(uE,uv+o,uWaveLod).a)*float((3-abs(gx))*(3-abs(gy)));}
gate=clamp((gate*0.0123456790-0.5)*uEdgeG+0.5,0.0,1.0);
gate=gate*gate*(3.0-2.0*gate);
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
    var pB = link(FB), pC = link(FC), pD = link(FD), pA = link(FA), pE = link(FE), pS = link(FSH), pR = link(FPR)
    if (!pR) return
    var OK = !!(pB && pC && pD && pA && pE && pS)
    gl.bindVertexArray(gl.createVertexArray())
    function locs(p, names) {
      var o = {}
      for (const n of names) o[n] = gl.getUniformLocation(p, n)
      return o
    }
    var UB = OK ? locs(pB, ['uA', 'uSim', 'uMaxLod', 'uTurbIso', 'uCurlIso', 'uShift']) : null
    var UC = OK ? locs(pC, ['uB', 'uSim', 'uMaxLod', 'uConfIso']) : null
    var UD = OK ? locs(pD, ['uA', 'uP', 'uSim', 'uMaxLod', 'uPoisIso', 'uShift']) : null
    var UA = OK ? locs(pA, ['uA', 'uB', 'uC', 'uP', 'uSim', 'uMaxLod', 'uSeg', 'uAdvScale', 'uAdvTurb', 'uAdvConf', 'uAdvVel', 'uAdvDiv', 'uVelTurb', 'uVelConf', 'uVelLap', 'uDivMin', 'uDamp', 'uVelScale', 'uForce', 'uRadius', 'uActive', 'uShift']) : null
    var UE = OK ? locs(pE, ['uA', 'uE', 'uPage', 'uSim', 'uMaxLod', 'uSeg', 'uDye', 'uInk', 'uRadius', 'uActive', 'uPickup', 'uHasPage', 'uFall', 'uBase', 'uObjK', 'uPageY', 'uPageS', 'uShift', 'uONR', 'uORad', 'uOSoft', 'uReflK', 'uReflA', 'uReflH', 'uCanv', 'uORect', 'uOCol']) : null
    var US = OK ? locs(pS, ['uA', 'uP', 'uSim', 'uMaxLod', 'uBump', 'uTime', 'uOcc', 'uGain', 'uPunch', 'uFrost']) : null
    var UR = locs(pR, ['uSH', 'uRes', 'uSim', 'uOpacity', 'uThr', 'uSnap', 'uWaveSoft', 'uWaveLod', 'uBright', 'uRim', 'uFrost', 'uEdgeG', 'uMinL', 'uBgL', 'uGlass', 'uLiq', 'uE'])
    if (OK) {
      gl.useProgram(pB)
      gl.uniform1i(UB.uA, 0)
      gl.uniform1f(UB.uTurbIso, dnum('liquidTurbIso', 0.9))
      gl.uniform1f(UB.uCurlIso, dnum('liquidCurlIso', 0.6))
      gl.useProgram(pC)
      gl.uniform1i(UC.uB, 1)
      gl.uniform1f(UC.uConfIso, dnum('liquidConfIso', 0.25))
      gl.useProgram(pD)
      gl.uniform1i(UD.uA, 0)
      gl.uniform1i(UD.uP, 3)
      gl.uniform1f(UD.uPoisIso, dnum('liquidPoisIso', 0.16))
      gl.useProgram(pA)
      gl.uniform1i(UA.uA, 0)
      gl.uniform1i(UA.uB, 1)
      gl.uniform1i(UA.uC, 2)
      gl.uniform1i(UA.uP, 3)
      gl.uniform1f(UA.uAdvScale, dnum('liquidAdvScale', 40))
      gl.uniform1f(UA.uAdvTurb, dnum('liquidAdvTurb', 1))
      gl.uniform1f(UA.uAdvConf, dnum('liquidAdvConf', 0.6))
      gl.uniform1f(UA.uAdvVel, dnum('liquidAdvVel', 0.05))
      gl.uniform1f(UA.uAdvDiv, dnum('liquidAdvDiv', 0))
      gl.uniform1f(UA.uVelTurb, dnum('liquidVelTurb', 0))
      gl.uniform1f(UA.uVelConf, dnum('liquidVelConf', 0))
      gl.uniform1f(UA.uDivMin, dnum('liquidDivMin', 0.1))
      gl.uniform1f(UA.uVelScale, dnum('liquidVelScale', 1))
      gl.uniform1f(UA.uRadius, Math.max(0.005, dnum('liquidRadius', 0.0316)))
      gl.useProgram(pE)
      gl.uniform1i(UE.uA, 0)
      gl.uniform1i(UE.uE, 5)
      gl.uniform1i(UE.uPage, 6)
      gl.uniform3fv(UE.uFall, LN)
      gl.uniform3fv(UE.uBase, tok('--BACKGROUND', '#e0e0e0'))
      gl.uniform1f(UE.uObjK, Math.max(0, dnum('liquidObjectSense', 9)))
      gl.uniform1f(UE.uInk, Math.max(0, dnum('liquidInk', 0.3)))
      gl.uniform1f(UE.uRadius, Math.max(0.005, dnum('liquidRadius', 0.0316)))
      gl.useProgram(pS)
      gl.uniform1i(US.uA, 0)
      gl.uniform1i(US.uP, 3)
      gl.uniform1f(US.uBump, dnum('glassBump', 3200))
      gl.uniform1f(US.uOcc, dnum('glassOcclusion', 0.7))
      gl.uniform1f(US.uFrost, dnum('glassFrost', 0.75))
      gl.uniform1f(US.uGain, dnum('liquidGain', 6))
      gl.uniform1f(US.uPunch, dnum('liquidPunch', 2.2))
    }
    var WSOFT = Math.max(0.5, dnum('liquidWaveSoft', 30))
    gl.useProgram(pR)
    gl.uniform1i(UR.uSH, 4)
    gl.uniform1i(UR.uE, 5)
    gl.uniform1f(UR.uOpacity, Math.max(0, Math.min(1, dnum('liquidOpacity', 1))))
    gl.uniform1f(UR.uBright, Math.max(1, dnum('glassBright', 1)))
    gl.uniform1f(UR.uEdgeG, Math.max(1, dnum('liquidEdgeGain', 6)))
    gl.uniform1f(UR.uRim, Math.max(0, Math.min(1, dnum('glassRim', 0.55))))
    gl.uniform1f(UR.uFrost, Math.max(0, Math.min(1, dnum('glassFrostMix', 0.5))))
    gl.uniform3fv(UR.uGlass, tok('--FROST', '#dcdcdc'))
    gl.uniform3fv(UR.uLiq, LN)
    gl.uniform1f(UR.uMinL, MINL)
    gl.uniform1f(UR.uBgL, BGL)
    gl.uniform1f(UR.uThr, Math.max(0.001, dnum('liquidThreshold', 0.045)))
    gl.uniform1f(UR.uSnap, Math.max(0, Math.min(1, dnum('liquidSnap', 0.05))))
    gl.uniform1f(UR.uWaveSoft, WSOFT)
    var FORCE = Math.max(0, dnum('liquidForce', 0.05))
    var OSOFT = Math.max(0.5, dnum('liquidEdgeSoft', 10))
    var REFLK = Math.max(0, dnum('liquidReflect', 2))
    var REFLA = Math.max(0, dnum('liquidReflectAmt', 1.6))
    var REFLH = Math.max(0, Math.min(1, dnum('liquidReflectHold', 1)))
    var DOVR = DAMPOVR !== null && Number.isFinite(DAMPOVR) ? DAMPOVR : -1
    var SPDREF = Math.max(0.05, dnum('liquidSpeedRef', 2))
    var PICK = Math.max(0, dnum('liquidPickup', 4))
    var PAGEY = 0, SHIFT = 0, SPREV = 0
    var SLOCK = /^(1|yes|true|on|page)$/i.test(String(DS.liquidScrollLock || ''))
    var SC = null
    function scrollY() {
      return SC ? SC.getBoundingClientRect().top : -(window.scrollY || 0)
    }
    var FMT = /^(1|yes|true|32)$/i.test(String(DS.liquidPrecision || '')) ? gl.RGBA32F : gl.RGBA16F
    var LINEAR = FMT === gl.RGBA16F || !!gl.getExtension('OES_texture_float_linear')
    var A0 = null, A1 = null, B = null, C = null, D0 = null, D1 = null, E0 = null, E1 = null, SHT = null
    var simW = 0, simH = 0, LODS = 0
    function target(w, h, mip) {
      var t = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texStorage2D(gl.TEXTURE_2D, mip ? LODS + 1 : 1, FMT, w, h)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? (LINEAR ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST) : (LINEAR ? gl.LINEAR : gl.NEAREST))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, LINEAR ? gl.LINEAR : gl.NEAREST)
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
    var MAXR = 64
    var vw = 0, vh = 0, ASP = 1, RPX = 1, RAD = 0
    var FROSTED = [], FCOL = [], RBUF = new Float32Array(MAXR * 4), RCOL = new Float32Array(MAXR * 3)
    var pcol = function (v, ia) {
      var m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(String(v))
      if (!m || (!ia && m[4] !== undefined && parseFloat(m[4]) < 0.35)) return null
      return [m[1], m[2], m[3]].map(function (c) {
        c = parseFloat(c) / 255
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
    }
    function scan() {
      SC = document.getElementById('smooth-content')
      FROSTED = [].slice.call(document.querySelectorAll('.GLASS,button,h3'))
      RAD = parseFloat(getComputedStyle(document.querySelector('.GLASS') || document.body).borderRadius) || 0
      FCOL = FROSTED.map(function (el) {
        var cs = getComputedStyle(el)
        return pcol(cs.backgroundColor) || pcol(cs.boxShadow, 1) || LN
      })
    }
    var RDIRTY = 1, RAGE = 0
    function rects() {
      var n = 0, ih = innerHeight
      for (var i = 0; i < FROSTED.length && n < MAXR; i++) {
        var b = FROSTED[i].getBoundingClientRect()
        if (b.width <= 0 || b.height <= 0 || b.bottom < 0 || b.top > ih) continue
        RBUF[n * 4] = (b.left + b.width * 0.5) * RPX
        RBUF[n * 4 + 1] = (ih - b.top - b.height * 0.5) * RPX
        RBUF[n * 4 + 2] = b.width * 0.5 * RPX
        RBUF[n * 4 + 3] = b.height * 0.5 * RPX
        RCOL[n * 3] = FCOL[i][0]; RCOL[n * 3 + 1] = FCOL[i][1]; RCOL[n * 3 + 2] = FCOL[i][2]
        n++
      }
      return n
    }
    function pushE() {
      if (!OK) return
      gl.useProgram(pE)
      gl.uniform1f(UE.uOSoft, OSOFT)
      gl.uniform1f(UE.uReflK, REFLK)
      gl.uniform1f(UE.uReflA, REFLA)
      gl.uniform1f(UE.uReflH, REFLH)
      gl.uniform1f(UE.uORad, RAD * RPX)
      gl.uniform2f(UE.uCanv, vw, vh)
      gl.uniform1f(UE.uHasPage, HASPAGE)
    }
    function resize() {
      var r = RPX = Math.min(devicePixelRatio || 1, DPR)
      var w = Math.max(1, Math.round(innerWidth * r))
      var h = Math.max(1, Math.round(innerHeight * r))
      if (w === vw && h === vh) return
      vw = canvas.width = w
      vh = canvas.height = h
      gl.useProgram(pR)
      gl.uniform2f(UR.uRes, w, h)
      if (!OK) return
      var sh = Math.max(64, Math.min(512, Math.round(h / RES)))
      var sw = Math.max(2, Math.round(sh * (w / h)))
      if (sw === simW && sh === simH) return
      simW = sw
      simH = sh
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
        gl.useProgram(q[0])
        gl.uniform2f(q[1].uSim, sw, sh)
        gl.uniform1f(q[1].uMaxLod, ml)
      }
      gl.useProgram(pR)
      gl.uniform2f(UR.uSim, sw, sh)
      gl.uniform1f(UR.uWaveLod, Math.max(0, Math.min(LODS, Math.log2(WSOFT))))
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
      if (pts && pts.length) for (i = 0; i < pts.length; i++) seg(pts[i].clientX / innerWidth, 1 - pts[i].clientY / innerHeight)
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
      gl.useProgram(prog)
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
    }
    var HASPAGE = 0
    var PAGES = 1, DOCH = 1
    var RTEX = null, RBUSY = false, RCSS = null, RIMG = new Map()
    var RS = Math.max(0.1, Math.min(1, dnum('liquidRasterScale', 0.5)))
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
      return css.replace(/(-?\d*\.?\d+)(svh|dvh|lvh|svw|dvw|lvw|vmin|vmax|vh|vw)\b/g, function (_, n, u) {
        var p = u === 'vmin' ? Math.min(w, h) : u === 'vmax' ? Math.max(w, h) : u.slice(-1) === 'w' ? w : h
        return Math.round(parseFloat(n) * p * 100) / 100 + 'px'
      })
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
    function rasterImgs(clone) {
      var imgs = [].slice.call(clone.querySelectorAll('img'))
      return Promise.all(imgs.map(function (im) {
        var src = im.getAttribute('src')
        if (!src) { im.remove(); return null }
        if (RIMG.has(src)) { im.setAttribute('src', RIMG.get(src)); return null }
        return fetch(src).then(function (r) { return r.blob() }).then(dataUrl).then(function (d) {
          RIMG.set(src, d)
          im.setAttribute('src', d)
        }).catch(function () { im.remove() })
      }))
    }
    var USEPAGE = !/^(0|no|false|off)$/i.test(String(DS.liquidPageRaster || ''))
    function buildRaster() {
      if (RBUSY || !USEPAGE) return
      RBUSY = true
      rasterCss().then(vpFreeze).then(function (css) {
        var sc0 = document.getElementById('smooth-content')
        var W = innerWidth
        var H = Math.max(innerHeight, Math.round(sc0 ? sc0.scrollHeight : document.body.scrollHeight))
        var cap = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096
        var rs = Math.min(RS, cap / Math.max(W, H))
        var clone = document.body.cloneNode(true)
        for (const sel of ['#GL', 'script', 'iframe', 'noscript']) for (const n of clone.querySelectorAll(sel)) n.remove()
        for (const p of clone.querySelectorAll('picture source')) p.remove()
        var cw = clone.querySelector('#smooth-wrapper')
        if (cw) cw.setAttribute('style', 'position:static;height:auto;overflow:visible')
        var cc = clone.querySelector('#smooth-content')
        if (cc) cc.setAttribute('style', 'transform:none;will-change:auto')
        for (const n of clone.querySelectorAll('[style]')) {
          var st = n.style
          st.removeProperty('opacity')
          st.removeProperty('filter')
          st.removeProperty('visibility')
          if (n !== cc && n !== cw) st.removeProperty('transform')
        }
        return rasterImgs(clone).then(function () {
          var html = new XMLSerializer().serializeToString(clone)
          var bgHex = HEX(CSSV.getPropertyValue('--BACKGROUND'), '#e0e0e0')
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
            '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + W +
            'px;height:' + H + 'px;background:' + bgHex + '"><style>' + css + '</style>' + html + '</div></foreignObject></svg>'
          var im = new Image()
          im.onload = function () {
            try {
              var cv = document.createElement('canvas')
              cv.width = Math.max(1, Math.round(W * rs))
              cv.height = Math.max(1, Math.round(H * rs))
              cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height)
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
              HASPAGE = 1
              pushE()
            } catch (e) { HASPAGE = 0 }
            RBUSY = false
          }
          im.onerror = function () { RBUSY = false }
          im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        })
      }).catch(function () { RBUSY = false })
    }
    var RT = 0
    function rstate() {
      var s = ''
      for (var i = 0; i < FROSTED.length && i < 8; i++) {
        var b = FROSTED[i].getBoundingClientRect()
        s += Math.round(b.top) + ',' + Math.round(b.left) + ',' + getComputedStyle(FROSTED[i]).opacity + ';'
      }
      return s
    }
    function rasterSoon() {
      clearTimeout(RT)
      var prev = '', same = 0, tries = 0
      function tick() {
        var v = document.hidden ? '' : rstate()
        if (v && v === prev) same++; else { same = 0; prev = v }
        if (!document.hidden && (same >= 3 || ++tries > 40)) {
          if (window.requestIdleCallback) requestIdleCallback(buildRaster, { timeout: 3000 })
          else buildRaster()
          return
        }
        RT = setTimeout(tick, 200)
      }
      RT = setTimeout(tick, 200)
    }
    var raf = 0, idle = 0, live = false, CLK = 0, NR = 0, prevT = 0
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
      prevT = 0
      SPREV = scrollY()
      RDIRTY = 1
      raf = requestAnimationFrame(frame)
    }
    function frame(now) {
      var DT = prevT ? Math.min(Math.max((now - prevT) / 1000, 1 / 240), 1 / 15) : 1 / FPS
      prevT = now
      if (QUE.length) { idle = 0; live = true; CLK += DT }
      if (!(OK && A0 && live)) return stop()
      var sy = scrollY()
      if (sy !== SPREV || --RAGE < 0) { RDIRTY = 1; RAGE = 30 }
      if (SLOCK) {
        SHIFT = Math.max(-0.5, Math.min(0.5, (sy - SPREV) / Math.max(innerHeight, 1)))
        gl.useProgram(pB); gl.uniform1f(UB.uShift, SHIFT)
        gl.useProgram(pD); gl.uniform1f(UD.uShift, SHIFT)
        gl.useProgram(pA); gl.uniform1f(UA.uShift, SHIFT)
        gl.useProgram(pE); gl.uniform1f(UE.uShift, SHIFT)
      }
      SPREV = sy
      PAGES = HASPAGE ? Math.min(1, innerHeight / Math.max(DOCH, 1)) : 1
      PAGEY = HASPAGE ? Math.max(0, Math.min(1 - PAGES, -sy / Math.max(DOCH, 1))) : 0
      if (RDIRTY) NR = rects()
      if (idle > QUIET) {
        for (const x of [A0, A1, B, C, D0, D1, E0, E1, SHT]) wipe(x)
        live = false
        return stop()
      }
      idle += DT
      gl.viewport(0, 0, simW, simH)
      bindAll()
      pass(pB, B)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.t)
      pass(pC, C)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, C.t)
      pass(pD, D1)
      var sd = D0; D0 = D1; D1 = sd
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, D0.t)
      gl.useProgram(pA)
      var nq = QUE.length >> 2
      if (nq) {
        var tot = 0
        for (var k = 0; k < nq; k++) {
          var ex = (QUE[k * 4 + 2] - QUE[k * 4]) * ASP, ey = QUE[k * 4 + 3] - QUE[k * 4 + 1]
          tot += Math.sqrt(ex * ex + ey * ey)
        }
        SEG[0] = QUE[0]; SEG[1] = QUE[1]
        SEG[2] = QUE[nq * 4 - 2]; SEG[3] = QUE[nq * 4 - 1]
        gl.uniform4f(UA.uSeg, SEG[0], SEG[1], SEG[2], SEG[3])
        gl.uniform1f(UA.uForce, FORCE * Math.min(tot / DT, SPDREF * 2) / SPDREF)
        ACT = 1
      } else ACT = 0
      gl.uniform1f(UA.uActive, ACT)
      gl.uniform1f(UA.uVelLap, Math.min(0.15, VLAP * DT * FPS))
      gl.uniform1f(UA.uDamp, DOVR >= 0 ? DOVR : 1 - Math.exp(-DT / VTAU))
      pass(pA, A1)
      var sa = A0; A0 = A1; A1 = sa
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A0.t)
      gl.useProgram(pE)
      gl.uniform1f(UE.uDye, Math.exp(-DT / LIFE))
      gl.uniform1f(UE.uPickup, 1 - Math.exp(-DT * PICK))
      gl.uniform1f(UE.uPageY, PAGEY)
      gl.uniform1f(UE.uPageS, PAGES)
      gl.uniform1f(UE.uActive, ACT)
      if (RDIRTY) {
        RDIRTY = 0
        gl.uniform1f(UE.uONR, NR)
        gl.uniform4fv(UE.uORect, RBUF)
        gl.uniform3fv(UE.uOCol, RCOL)
      }
      if (ACT) gl.uniform4f(UE.uSeg, SEG[0], SEG[1], SEG[2], SEG[3])
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, E0.t)
      pass(pE, E1)
      var se = E0; E0 = E1; E1 = se
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, E0.t)
      gl.useProgram(pS)
      gl.uniform1f(US.uTime, CLK)
      pass(pS, SHT)
      QUE.length = 0
      gl.useProgram(pR)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, SHT.t)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault()
      cancelAnimationFrame(raf)
      raf = 0
    })
    addEventListener('resize', function () { HASPAGE = 0; scan(); resize(); pushE(); RDIRTY = 1; kick(); rasterSoon() })
    addEventListener('orientationchange', resize)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else kick()
    })
    scan()
    resize()
    pushE()
    if (document.readyState === 'complete') rasterSoon()
    else addEventListener('load', rasterSoon, { once: true })
    raf = requestAnimationFrame(frame)
  })()
  ; (function () {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return
    var all = function (r, s) { return [...r.querySelectorAll(s)] }
    var TEXT = 'h1, h2, h3, h4, p, cite, button'
    var SLIDES =
      '#HOME section:nth-of-type(1), #HOME section:nth-of-type(2) article, .QUOTE, #OFFERS section, #PROFILE'
    var RANK = { H1: 0, H2: 1, H4: 2, H3: 3, P: 4, CITE: 5, BUTTON: 6 }
    var DUR = 0.95
    var EASE = 'expo.out'
    var BLUR = 10
    var STEP = 0.05
    var SIB = 0.1
    var LINE = 0.15
    var START = 'top bottom'
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
    function words(el) {
      var out = [],
        nodes = [],
        w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) nodes.push(w.currentNode)
      for (const n of nodes) {
        if (!n.nodeValue.trim()) continue
        var f = document.createDocumentFragment()
        for (const part of n.nodeValue.split(/(\s+)/)) {
          if (!part) continue
          if (!part.trim()) {
            f.appendChild(document.createTextNode(part))
            continue
          }
          var sp = document.createElement('span')
          sp.className = 'W'
          sp.textContent = part
          f.appendChild(sp)
          out.push(sp)
        }
        n.parentNode.replaceChild(f, n)
      }
      return out
    }
    function lines(ws) {
      var out = [],
        top = -1e9,
        n = -1
      for (const w of ws) {
        var r = w.getBoundingClientRect()
        if (r.top > top + r.height * 0.5) {
          n++
          top = r.top
        }
        out.push(n)
      }
      return out
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
        return !t.closest('nav')
      })
      .map(function (t) {
        var raw = t.textContent.trim(),
          s = { el: t, at: (RANK[t.tagName] || 0) * STEP + sib(t) * SIB }
        if (t.tagName === 'P' && /^\+?\d+$/.test(raw)) {
          s.pre = raw.charAt(0) === '+' ? '+' : ''
          s.end = Number.parseInt(raw, 10)
          s.t = [t]
          t.textContent = s.pre + '0'
        } else s.t = words(t)
        return s
      })
    sets.forEach(function (s) {
      gsap.set(s.t, FROM)
    })
    all(document, SLIDES).forEach(function (b) {
      gsap.fromTo(
        b,
        { y: RISE },
        {
          y: 0,
          duration: DUR,
          ease: EASE,
          delay: sib(b) * SIB,
          clearProps: 'all',
          scrollTrigger: trig(b)
        }
      )
    })
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
        var tw,
          ln = lines(s.t),
          v = {
            ...TO,
            duration: DUR,
            ease: EASE,
            delay: s.at,
            stagger: function (i) {
              return ln[i] * LINE
            },
            scrollTrigger: trig(s.el)
          }
        if (s.end !== undefined)
          v.onUpdate = function () {
            if (tw) s.el.textContent = s.pre + Math.round(tw.ratio * s.end)
          }
        tw = gsap.fromTo(s.t, FROM, v)
      })
      ScrollTrigger.refresh()
    })
    var list = document.querySelector('[role="tablist"]')
    if (list) {
      var tabs = all(list, '[role="tab"]')
      var pick = function (t) {
        for (const o of tabs) {
          var on = o === t
          o.setAttribute('aria-selected', on)
          o.tabIndex = on ? 0 : -1
          var v = document.getElementById(o.getAttribute('aria-controls'))
          v.hidden = !on
          if (!on) continue
          var f = v.querySelector('iframe[data-src]')
          if (f) {
            f.src = f.dataset.src
            f.removeAttribute('data-src')
          }
        }
        t.focus()
        ScrollTrigger.refresh()
      }
      list.addEventListener('click', function (e) {
        var t = e.target.closest('[role="tab"]')
        if (t) pick(t)
      })
      list.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(document.activeElement)
        if (i < 0) return
        if (e.key === 'ArrowRight') pick(tabs[(i + 1) % tabs.length])
        else if (e.key === 'ArrowLeft') pick(tabs[(i + tabs.length - 1) % tabs.length])
      })
    }
  })()
