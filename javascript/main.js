{
  const { gsap, ScrollTrigger, ScrollSmoother } = globalThis
  if (ScrollSmoother && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
    if (!ScrollSmoother.get()) ScrollSmoother.create({ smooth: 1.25, smoothTouch: 0.125, normalizeScroll: true, ignoreMobileResize: true })
  }
  const fluid = () => {
    const canvas = document.getElementById('GL')
    const gl = canvas?.getContext('webgl2', { alpha: true, depth: false, stencil: false, antialias: false, powerPreference: 'high-performance' })
    if (!gl) return
    const WAKE = !matchMedia('(prefers-reduced-motion: reduce)').matches
    const FORCE = 0.05, RAD = 0.001, ADVS = 40, WSOFT = 30, THR = 0.035, MARG = 16, NS = 8, SPDRANGE = 0.4, SPDCAP = 3, SPDTAU = 0.06, INK = 0.45, LIFE = 0.5, DYELAP = 0.1, LIQ = 0xe0 / 255
    const glf = x => (Number.isInteger(x) ? x + '.0' : String(+x.toFixed(6)))
    const look = () => {
      const i = document.createElement('i')
      i.className = 'GLASS'
      document.body.append(i)
      const cs = getComputedStyle(i)
      const bf = /brightness\(([\d.]+)\)/.exec(String(cs.backdropFilter || cs.webkitBackdropFilter || ''))
      const bs = String(cs.boxShadow || '')
      i.remove()
      const a = [], c = []
      for (const m of bs.matchAll(/rgba?\(([^)]*)\)([^,]*)/g)) {
        if (!m[2].includes('inset')) continue
        const sc = m[1].split(',').map(Number.parseFloat)
        const sn = m[2].trim().split(/\s+/).map(Number.parseFloat)
        a.push(`vec4(${glf(sc[3] ?? 1)},${glf(1.702 / Math.max(0.25, (sn[2] || 0) / 2))},${glf(sn[3] || 0)},0.0)`)
        c.push(`vec3(${glf(sc[0] / 255)},${glf(sc[1] / 255)},${glf(sc[2] / 255)})`)
      }
      if (!c.length) {
        a.push('vec4(0.0,1.0,0.0,0.0)')
        c.push('vec3(0.0)')
      }
      return `#version 300 es
precision highp float;
precision highp sampler2D;
#define SHN ${c.length}
out vec4 O;
uniform sampler2D uSH;
uniform vec2 uRes;
uniform vec4 uTex,uCv;
const vec4 SHA[SHN]=vec4[SHN](${a.join(',')});
const vec3 SHC[SHN]=vec3[SHN](${c.join(',')});
const vec3 COL=vec3(${glf(Math.min(1, LIQ * (bf ? Number.parseFloat(bf[1]) : 1)))});
const float TH=${glf(THR)},SOFT=0.25;
void main(){
vec2 uv=uCv.xy+gl_FragCoord.xy/uRes*uCv.zw;
vec2 h=vec2(uTex.x,-uTex.y);
vec2 a=texture(uSH,uv+uTex.xy).xy,b=texture(uSH,uv-uTex.xy).xy,c=texture(uSH,uv+h).xy,d=texture(uSH,uv-h).xy;
vec2 gx=(a+c-b-d)*0.5/uTex.z,gy=(a+d-b-c)*0.5/uTex.w,gn=max(sqrt(gx*gx+gy*gy),1e-6),th=vec2(0.5,TH)*(1.0+SOFT*vec2(0.6,1.0)),v=(a+b+c+d)*0.25;
vec2 dd=(v-th)/gn;
float k=max(10.0-abs(dd.x-dd.y),0.0)*0.1;
float dist=min(dd.x,dd.y)-k*k*2.5;
vec2 n=dd.x<dd.y?vec2(gx.x,gy.x)/gn.x:vec2(gx.y,gy.y)/gn.y;
for(int j=0;j<2;j++)if(dist>0.0&&dist<50.0){
vec2 db=(texture(uSH,uv-n*dist*2.0*uTex.xy/uTex.zw).xy-th)/gn;
dist+=max(min(db.x,db.y),-dist);}
float cov=smoothstep(0.5,0.5+SOFT*0.6,v.x)*smoothstep(TH,TH*(1.0+SOFT*2.0),v.y)*smoothstep(-1.5,1.5,dist+1.5);
if(cov<=0.0){O=vec4(0.0);return;}
vec3 col=COL;
for(int i=SHN-1;i>=0;i--)col=mix(col,SHC[i],SHA[i].x/(1.0+exp(min(SHA[i].y*(dist-SHA[i].z),80.0))));
float dth=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))-0.5)/255.0;
float oa=clamp(cov+dth*min(1.0,cov*255.0),0.0,1.0);
O=vec4(clamp(col*oa+dth,vec3(0.0),vec3(oa)),oa);}`
    }
    const VS = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`
    const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 O;
uniform vec2 uSim;
uniform float uMaxLod;
float reduce(mat3 a,mat3 b){mat3 p=matrixCompMult(a,b);return p[0][0]+p[0][1]+p[0][2]+p[1][0]+p[1][1]+p[1][2]+p[2][0]+p[2][1]+p[2][2];}
vec2 normz(vec2 x){return dot(x,x)>1e-20?normalize(x):vec2(0.0);}
#define F9(S,M) vec4 d=textureLod(S,uv+t.ww,M),dn=textureLod(S,uv+t.wy,M),de=textureLod(S,uv+t.xw,M),ds=textureLod(S,uv+t.wz,M),dw=textureLod(S,uv-t.xw,M),dnw=textureLod(S,uv-t.xz,M),dsw=textureLod(S,uv-t.xy,M),dne=textureLod(S,uv+t.xy,M),dse=textureLod(S,uv+t.xz,M);
#define M9(C) mat3(dnw.C,dn.C,dne.C,dw.C,d.C,de.C,dsw.C,ds.C,dse.C)
`
    const SEG = `uniform vec4 uCv,uSeg[${NS}],uSegK[${NS}];
uniform int uNSeg;
float spg(vec2 uv){vec2 q=max(max(uCv.xy-uv,uv-uCv.xy-uCv.zw),0.0)/max(uCv.xy,1e-6);float t=clamp(max(q.x,q.y),0.0,1.0);return 1.0-0.3*t*t;}
vec2 svSeg(vec2 p,vec2 a,vec2 b){vec2 ab=b-a,ap=p-a;return ap-ab*clamp(dot(ap,ab)/max(dot(ab,ab),1e-9),0.0,1.0);}
`
    const SRC = {
      B: HEAD + `uniform sampler2D uA;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
mat3 txx=1.1*mat3(0.125,0.25,0.125,-0.25,-0.5,-0.25,0.125,0.25,0.125);
mat3 tyy=1.1*mat3(0.125,-0.25,0.125,0.25,-0.5,0.25,0.125,-0.25,0.125);
mat3 txy=0.9*mat3(0.25,0.0,-0.25,0.0,0.0,0.0,-0.25,0.0,0.25);
mat3 cx=mat3(0.6,1.0,0.6,0.0,0.0,0.0,-0.6,-1.0,-0.6);
mat3 cy=mat3(0.6,0.0,-0.6,1.0,0.0,-1.0,0.6,0.0,-0.6);
vec2 v=vec2(0.0);
float curl=0.0,cw=0.0;
for(int i=0;i<11;i++){
float mip=float(i),cwf=1.0/float(i+1);
cw+=cwf;
if(mip>=uMaxLod)continue;
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
F9(uA,mip)
mat3 mx=M9(x),my=M9(y);
v+=vec2(reduce(txx,mx)+reduce(txy,my),reduce(tyy,my)+reduce(txy,mx));
curl+=cwf*(reduce(cx,mx)+reduce(cy,my));}
O=vec4(v,0.0,curl/cw);}`,
      C: HEAD + `uniform sampler2D uB;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
mat3 cx=mat3(-0.25,-0.5,-0.25,0.0,0.0,0.0,0.25,0.5,0.25);
mat3 cy=mat3(-0.25,0.0,0.25,-0.5,0.0,0.5,-0.25,0.0,0.25);
vec2 v=vec2(0.0);
for(int i=0;i<11;i++){
float mip=float(i);
if(mip>=uMaxLod)break;
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
F9(uB,mip)
mat3 mc=M9(w);
mc=mat3(abs(mc[0]),abs(mc[1]),abs(mc[2]));
v+=d.w*normz(vec2(reduce(cx,mc),reduce(cy,mc)));}
O=vec4(v/11.0,0.0,0.0);}`,
      D: HEAD + `uniform sampler2D uA,uP;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
mat3 px=mat3(0.16,0.0,-0.16,0.68,0.0,-0.68,0.16,0.0,-0.16);
mat3 py=mat3(-0.16,-0.68,-0.16,0.0,0.0,0.0,0.16,0.68,0.16);
mat3 gs=mat3(0.0625,0.125,0.0625,0.125,0.25,0.125,0.0625,0.125,0.0625);
vec2 v=vec2(0.0);
float wc=0.0,pt=textureLod(uP,uv,uMaxLod).x;
for(int i=0;i<11;i++){
float mip=float(i),w=1.0/float(i+1);
wc+=w;
if(mip>=uMaxLod){v.y+=w*pt;continue;}
vec2 tx=exp2(mip)/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
mat3 mx,my,mp;
{F9(uA,mip) mx=M9(x); my=M9(y);}
{F9(uP,mip) mp=M9(x);}
v+=w*vec2(reduce(px,mx)+reduce(py,my),reduce(gs,mp));}
O=vec4((v.x+v.y)/wc);}`,
      A: HEAD + SEG + `uniform sampler2D uA,uB,uC,uP;
uniform float uAdvScale,uVelLap,uDamp;
vec2 diffP(vec2 uv){
vec2 tx=1.0/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
float dn=texture(uP,uv+t.wy).x,de=texture(uP,uv+t.xw).x,ds=texture(uP,uv+t.wz).x,dw=texture(uP,uv-t.xw).x,dnw=texture(uP,uv-t.xz).x,dsw=texture(uP,uv-t.xy).x,dne=texture(uP,uv+t.xy).x,dse=texture(uP,uv+t.xz).x;
return vec2(0.5*(de-dw)+0.25*(dne-dnw+dse-dsw),0.5*(dn-ds)+0.25*(dne+dnw-dse-dsw));}
vec2 lapV(vec2 uv){
vec2 tx=1.0/uSim;
vec4 t=vec4(tx,-tx.y,0.0);
vec2 d=texture(uA,uv).xy,dn=texture(uA,uv+t.wy).xy,de=texture(uA,uv+t.xw).xy,ds=texture(uA,uv+t.wz).xy,dw=texture(uA,uv-t.xw).xy,dnw=texture(uA,uv-t.xz).xy,dsw=texture(uA,uv-t.xy).xy,dne=texture(uA,uv+t.xy).xy,dse=texture(uA,uv+t.xz).xy;
return (-20.0*d+4.0*(de+dw+dn+ds)+dne+dnw+dse+dsw)/6.0;}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 tx=1.0/uSim;
vec2 dvel=vec2(0.0),off=vec2(0.0);
vec4 adv=vec4(0.0);
for(int i=0;i<3;i++){
vec2 turb=texture(uB,uv+tx*off).xy;
vec2 conf=texture(uC,uv+tx*off).xy;
vec2 vel=texture(uA,uv+tx*off).xy;
off=(float(i+1)/3.0)*-uAdvScale*(-0.05*vel+turb-0.6*conf);
vec2 q=uv+tx*off;
adv+=texture(uA,q);
dvel+=uVelLap*lapV(q)+0.01*conf-uDamp*vel-0.1*diffP(q);}
vec2 nv=(adv.xy+dvel)/3.0*spg(uv);
if(uNSeg>0){
vec2 asp=vec2(uSim.x/uSim.y,1.0),p=uv*asp,fs=vec2(0.0);
float gm=0.0,gs=1e-20;
for(int i=0;i<${NS};i++){
if(i>=uNSeg)break;
if(uSegK[i].x<=0.0)continue;
vec4 s=uSeg[i]*asp.xyxy;
vec2 q=svSeg(p,s.xy,s.zw);
float g=exp(max(-12.0,-dot(q,q)/uSegK[i].y));
fs+=uSegK[i].x*g*normz(s.xy-s.zw);
gs+=g;
gm=max(gm,g);}
nv+=fs*gm/gs;}
O=vec4(nv,off);}`,
      E: HEAD + SEG + `uniform sampler2D uA,uE;
uniform float uDye,uDyeLap;
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
vec2 sp=uv+texture(uA,uv).zw/uSim;
float e=mix(texture(uE,sp).a,textureLod(uE,sp,1.0).a,uDyeLap)*uDye*spg(uv);
if(uNSeg>0){
vec2 asp=vec2(uSim.x/uSim.y,1.0),p=uv*asp;
float g=0.0;
for(int i=0;i<${NS};i++){
if(i>=uNSeg)break;
vec4 s=uSeg[i]*asp.xyxy;
vec2 q=svSeg(p,s.xy,s.zw);
g=max(g,exp(max(-12.0,-dot(q,q)/uSegK[i].y))*uSegK[i].z);}
e+=min(g,1.0)*(1.0-e);}
O=vec4(e);}`,
      V: HEAD + `uniform sampler2D uE;
uniform vec2 uGrid;
void main(){
vec2 uv=gl_FragCoord.xy/uGrid;
const float TH=${glf(THR)},EW=${glf(THR * 0.95)};
vec2 et=${glf(WSOFT * 0.5)}/uSim;
float g=0.0;
for(int gy=-5;gy<=5;gy++)for(int gx=-5;gx<=5;gx++){
vec2 q=uv+vec2(float(gx),float(gy))*et;
if(q!=clamp(q,0.0,1.0))continue;
g+=smoothstep(TH-EW,TH+EW,textureLod(uE,q,${glf(Math.log2(WSOFT))}).a)*float((6-abs(gx))*(6-abs(gy)));}
O=vec4(g/1296.0);}`,
      S: HEAD + `uniform sampler2D uV,uE;
uniform vec2 uGrid;
uniform int uDl;
vec4 bsw(float f){float q=1.0-f,f2=f*f,f3=f2*f;return vec4(q*q*q,3.0*f3-6.0*f2+4.0,-3.0*f3+3.0*f2+3.0*f+1.0,f3)/6.0;}
vec4 bsv(sampler2D s,int l,vec2 uv){
vec2 p=uv*uGrid-0.5,f=fract(p);
ivec2 i=ivec2(p-f)-1,mx=ivec2(uGrid)-1;
vec4 wx=bsw(f.x),wy=bsw(f.y),o=vec4(0.0);
for(int j=0;j<4;j++){
int y=clamp(i.y+j,0,mx.y);
vec4 r=vec4(0.0);
for(int k=0;k<4;k++)r+=wx[k]*texelFetch(s,ivec2(clamp(i.x+k,0,mx.x),y),l);
o+=wy[j]*r;}
return o;}
void main(){
vec2 uv=gl_FragCoord.xy/uSim;
O=vec4(bsv(uV,0,uv).x,bsv(uE,uDl,uv).a,0.0,0.0);}`,
      M: `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 O;
uniform sampler2D uS;
uniform vec4 uR;
void main(){
vec2 a=floor(gl_FragCoord.xy)*uR.xy,b=a+uR.xy;
vec4 o=vec4(0.0);
for(int j=0;j<4;j++){
float y=floor(a.y)+float(j),wy=min(b.y,y+1.0)-max(a.y,y);
if(wy<=0.0)break;
for(int i=0;i<4;i++){
float x=floor(a.x)+float(i),wx=min(b.x,x+1.0)-max(a.x,x);
if(wx<=0.0)break;
o+=wx*wy*textureLod(uS,(vec2(x,y)+0.5)/uR.zw,0.0);}}
O=o/(uR.x*uR.y);}`,
      N: `#version 300 es
precision highp float;
out vec4 O;
uniform float uW;
uint hs(uint n){n=(n<<13U)^n;return n*(n*n*15731U+789221U)+1376312589U;}
void main(){
uvec2 p=uvec2(gl_FragCoord.xy);
uint c=p.x+uint(uW)*p.y,n=hs(c);
uvec3 k=n*uvec3(n,n*16807U,n*48271U);
O=1e-6*vec4(vec3(k&uvec3(0x7fffffffU)),float(hs(c+75132895U)&0x7fffffffU))/2147483647.0;}`
    }
    const UNIT = { uA: 0, uB: 1, uC: 2, uP: 3, uSH: 4, uE: 5, uS: 6, uV: 7 }
    const P = {}, U = {}, T = {}
    const PTR = new Map(), QUE = [], SPL = [], SEGS = new Float32Array(NS * 4), SEGK = new Float32Array(NS * 4)
    let cur = null, SC = null, vw = 0, vh = 0, CW = 1, CH = 1, ASP = 1, CASP = 1, OX = 0, OY = 0, SX = 1, SY = 1, simW = 0, simH = 0, cvW = 1, cvH = 1, SPLR = 0
    let MX = -1, MY = -1, WKT = -1e9, VW = null, SPREV = 0, raf = 0, idle = 0, live = false, prevT = 0, LDT = 0, UDT = 1, DTD = true, BND = true, LNS = -1
    const use = p => {
      if (p === cur) return
      gl.useProgram(p)
      cur = p
    }
    const uni = (k, n, fn, ...v) => {
      use(P[k])
      gl['uniform' + fn](U[k][n], ...v)
    }
    const shader = (src, type) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const boot = () => {
      if (!gl.getExtension('EXT_color_buffer_float')) return false
      cur = null
      SRC.R = look()
      const vs = shader(VS, gl.VERTEX_SHADER)
      for (const [k, src] of Object.entries(SRC)) {
        const p = gl.createProgram()
        gl.attachShader(p, vs)
        gl.attachShader(p, shader(src, gl.FRAGMENT_SHADER))
        gl.linkProgram(p)
        P[k] = p
      }
      for (const [k, p] of Object.entries(P)) {
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.error(k, gl.getProgramInfoLog(p), ...gl.getAttachedShaders(p).map(s => gl.getShaderInfoLog(s)))
          return false
        }
        use(p)
        const u = {}
        U[k] = u
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(p, i).name.replace('[0]', '')
          u[name] = gl.getUniformLocation(p, name)
          if (name in UNIT) gl.uniform1i(u[name], UNIT[name])
        }
      }
      gl.bindVertexArray(gl.createVertexArray())
      return true
    }
    const cx = x => OX + x * SX
    const cy = y => OY + (1 - y) * SY
    const scrollTop = () => SC?.getBoundingClientRect().top ?? -scrollY
    const wipe = x => {
      gl.clearColor(0, 0, 0, 0)
      for (const g of x.l) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, g)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
    }
    const target = (w, h, n) => {
      const t = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texStorage2D(gl.TEXTURE_2D, n + 1, gl.RGBA16F, w, h)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, n ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const o = { t, n, l: [] }
      for (let L = 0; L <= n; L++) {
        const g = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, g)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, L)
        o.l.push(g)
      }
      wipe(o)
      return o
    }
    const drop = x => {
      gl.deleteTexture(x.t)
      for (const g of x.l) gl.deleteFramebuffer(g)
    }
    const mips = x => {
      use(P.M)
      gl.activeTexture(gl.TEXTURE6)
      gl.bindTexture(gl.TEXTURE_2D, x.t)
      for (let L = 1; L <= x.n; L++) {
        const sw = Math.max(1, simW >> (L - 1)), sh = Math.max(1, simH >> (L - 1)), dw = Math.max(1, simW >> L), dh = Math.max(1, simH >> L)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, L - 1)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, L - 1)
        gl.bindFramebuffer(gl.FRAMEBUFFER, x.l[L])
        gl.viewport(0, 0, dw, dh)
        gl.uniform4f(U.M.uR, sw / dw, sh / dh, sw, sh)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, x.n)
      gl.viewport(0, 0, simW, simH)
    }
    const seed = () => {
      use(P.N)
      gl.uniform1f(U.N.uW, simW)
      gl.viewport(0, 0, simW, simH)
      for (const x of [T.A0, T.D0]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, x.l[0])
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        mips(x)
      }
    }
    const bind = (unit, t) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
    }
    const bindAll = () => {
      for (const [u, k] of [[0, 'A0'], [1, 'B'], [2, 'C'], [3, 'D0'], [4, 'SHT'], [5, 'E0'], [7, 'CV']]) bind(u, T[k].t)
      BND = false
    }
    const pass = (k, dst) => {
      use(P[k])
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.l[0])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (dst.n) mips(dst)
    }
    const flip = (a, b, unit) => {
      const t = T[a]
      T[a] = T[b]
      T[b] = t
      bind(unit, T[a].t)
    }
    const resize = () => {
      const r = Math.min(devicePixelRatio || 1, 1.5)
      CW = canvas.clientWidth || innerWidth
      CH = canvas.clientHeight || innerHeight
      const w = Math.max(1, Math.round(CW * r)), h = Math.max(1, Math.round(CH * r))
      if (w === vw && h === vh) return
      vw = w
      vh = h
      canvas.width = w
      canvas.height = h
      const ch = Math.max(64, Math.min(512, Math.round(h / 3))), cw = Math.max(2, Math.round(ch * w / h)), sw = cw + 2 * MARG, sh = ch + 2 * MARG
      SX = cw / sw
      SY = ch / sh
      OX = MARG / sw
      OY = MARG / sh
      CASP = cw / ch
      uni('R', 'uRes', '2f', w, h)
      uni('R', 'uTex', '4f', 0.5 / sw, 0.5 / sh, CW / cw, CH / ch)
      uni('R', 'uCv', '4f', OX, OY, SX, SY)
      if (sw === simW && sh === simH) return
      simW = sw
      simH = sh
      SPLR = (0.85 * WSOFT / sh) ** 2
      ASP = sw / sh
      const lods = Math.floor(Math.log2(Math.max(sw, sh))), wl = Math.max(0, Math.min(lods, Math.floor(Math.log2(WSOFT)) - 1)), el = Math.min(lods, Math.ceil(Math.log2(WSOFT)))
      BND = true
      for (const x of Object.values(T)) drop(x)
      cvW = Math.max(1, sw >> wl)
      cvH = Math.max(1, sh >> wl)
      for (const k of ['A0', 'A1', 'B', 'D0', 'D1']) T[k] = target(sw, sh, lods)
      T.C = target(sw, sh, 0)
      T.E0 = target(sw, sh, el)
      T.E1 = target(sw, sh, el)
      T.CV = target(cvW, cvH, 0)
      T.SHT = target(sw, sh, 0)
      for (const k of 'ABCDESV') {
        uni(k, 'uSim', '2f', sw, sh)
        gl.uniform1f(U[k].uMaxLod ?? null, lods)
        gl.uniform4f(U[k].uCv ?? null, OX, OY, SX, SY)
        gl.uniform2f(U[k].uGrid ?? null, cvW, cvH)
      }
      uni('S', 'uDl', '1i', wl)
      seed()
    }
    const seg = (id, x, y) => {
      const p = PTR.get(id)
      if (!p) {
        PTR.set(id, [x, y, -1])
        return
      }
      const dx = (x - p[0]) * ASP, dy = y - p[1]
      if (dx * dx + dy * dy < 4e-6 * SY * SY || QUE.length >= 640) return
      QUE.push(id, p[0], p[1], x, y)
      p[0] = x
      p[1] = y
      kick()
    }
    const move = e => {
      const x = cx(e.clientX / CW), y = cy(e.clientY / CH)
      if (e.pointerType === 'mouse') {
        MX = x
        MY = y
      }
      const pts = e.getCoalescedEvents?.() ?? []
      if (!pts.length) seg(e.pointerId, x, y)
      for (const q of pts) seg(e.pointerId, cx(q.clientX / CW), cy(q.clientY / CH))
    }
    const down = e => {
      move(e)
      SPL.push(cx(e.clientX / CW), cy(e.clientY / CH), performance.now() + 100)
      kick()
    }
    const scrolled = e => {
      if (e.clientX !== undefined) {
        MX = cx(e.clientX / CW)
        MY = cy(e.clientY / CH)
      }
      WKT = performance.now()
      kick()
    }
    const stop = () => {
      raf = 0
      prevT = 0
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    const kick = () => {
      if (raf) return
      BND = true
      prevT = 0
      SPREV = scrollTop()
      raf = requestAnimationFrame(frame)
    }
    const timing = now => {
      const DT = prevT ? Math.min(Math.max((now - prevT) / 1000, 1 / 240), 1 / 15) : 1 / 60
      prevT = now
      if (Math.abs(DT - LDT) > LDT * 0.01) {
        LDT = DT
        UDT = DT * 60
        DTD = true
      }
      return DT
    }
    const rates = () => {
      uni('A', 'uVelLap', '1f', Math.min(0.15, 0.02 * UDT))
      gl.uniform1f(U.A.uDamp, 1 - 0.9999 ** UDT)
      gl.uniform1f(U.A.uAdvScale, ADVS * UDT)
      uni('E', 'uDye', '1f', Math.exp(-LDT / LIFE))
      gl.uniform1f(U.E.uDyeLap, Math.min(1, DYELAP * UDT))
      DTD = false
    }
    const put = (p, i, j, k, n) => {
      if (n >= NS) return n
      SEGS.set([p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1]], n * 4)
      SEGK.set(k, n * 4)
      return n + 1
    }
    const group = () => {
      const g = new Map()
      for (let k = 0; k < QUE.length; k += 5) {
        const id = QUE[k], x0 = QUE[k + 1], y0 = QUE[k + 2], x1 = QUE[k + 3], y1 = QUE[k + 4]
        if (x0 === x1 && y0 === y1) {
          g.set('s' + k, { p: [x0, y0], l: 0 })
          continue
        }
        const o = g.get(id) ?? { id, p: [x0, y0], l: 0 }
        g.set(id, o)
        o.p.push(x1, y1)
        o.l += Math.hypot((x1 - x0) * ASP, y1 - y0)
      }
      return [...g.values()]
    }
    const stride = ps => {
      let s = 1, c = NS + 1
      while (c > NS && s < 64) {
        c = 0
        for (const o of ps) c += Math.max(1, Math.ceil((o.p.length / 2 - 1) / s))
        if (c > NS) s++
      }
      return s
    }
    const speed = (o, DT) => {
      const t = PTR.get(o.id), r = Math.min(o.l / SY / DT, SPDCAP)
      if (!t) return r
      t[2] = t[2] < 0 ? r : t[2] + (r - t[2]) * (1 - Math.exp(-DT / SPDTAU))
      return t[2]
    }
    const stroke = DT => {
      if (!QUE.length) return 0
      const ps = group(), s = stride(ps)
      let n = 0
      for (const o of ps) {
        const m = o.p.length / 2 - 1
        if (!m) {
          n = put(o.p, 0, 0, [0, SPLR, INK * UDT, 0], n)
          continue
        }
        const v = speed(o, DT), kv = 1 + SPDRANGE * Math.max(0, v - 1), k = [FORCE * UDT * v, RAD * kv * kv * Math.max(CASP * CASP, 1) * SY * SY, INK * UDT * Math.max(v, 0.5), 0]
        for (let i = 0; i < m; i += s) n = put(o.p, i, Math.min(m, i + s), k, n)
      }
      return n
    }
    const sim = DT => {
      gl.viewport(0, 0, simW, simH)
      if (BND) bindAll()
      if (DTD) rates()
      pass('B', T.B)
      pass('C', T.C)
      pass('D', T.D1)
      flip('D0', 'D1', 3)
      const ns = stroke(DT)
      QUE.length = 0
      for (const k of 'AE') {
        use(P[k])
        if (ns) {
          gl.uniform4fv(U[k].uSeg, SEGS, 0, ns * 4)
          gl.uniform4fv(U[k].uSegK, SEGK, 0, ns * 4)
        }
        if (ns !== LNS) gl.uniform1i(U[k].uNSeg, ns)
      }
      LNS = ns
      pass('A', T.A1)
      flip('A0', 'A1', 0)
      pass('E', T.E1)
      flip('E0', 'E1', 5)
      gl.viewport(0, 0, cvW, cvH)
      pass('V', T.CV)
      gl.viewport(0, 0, simW, simH)
      pass('S', T.SHT)
      use(P.R)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, vw, vh)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const feed = (sy, now) => {
      for (let i = 0; i < SPL.length; i += 3) QUE.push(-1, SPL[i], SPL[i + 1], SPL[i], SPL[i + 1])
      for (let i = SPL.length - 3; i >= 0; i -= 3) if (SPL[i + 2] < now) SPL.splice(i, 3)
      const d = sy - SPREV
      if (!WAKE || MX < 0 || now - WKT > 1500 || Math.abs(d) < 0.5) {
        VW = null
        PTR.delete('w')
        return
      }
      if (!VW) SPL.push(MX, MY, now + 100)
      if (!VW || VW[1] < OY || VW[1] > OY + SY) {
        VW = [MX, MY]
        PTR.delete('w')
        seg('w', MX, MY)
      }
      VW[1] -= d / Math.max(CH, 1) * SY
      seg('w', VW[0], VW[1])
    }
    const frame = now => {
      const DT = timing(now), sy = WAKE ? scrollTop() : 0
      feed(sy, now)
      if (QUE.length) {
        idle = 0
        live = true
      }
      if (!T.A0 || !live) {
        if (!T.A0 || MX < 0 || now - WKT >= 1500) {
          stop()
          return
        }
        SPREV = sy
        raf = requestAnimationFrame(frame)
        return
      }
      SPREV = sy
      if (idle > 1) {
        for (const x of Object.values(T)) wipe(x)
        seed()
        live = false
        stop()
        return
      }
      idle += DT
      sim(DT)
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (!boot()) return false
      SC = document.getElementById('smooth-content')
      resize()
      return true
    }
    const halt = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const go = () => {
      if (!start()) return
      const opt = { passive: true }, cap = { passive: true, capture: true }
      const reset = () => {
        PTR.clear()
        MX = -1
      }
      addEventListener('pointermove', move, opt)
      addEventListener('pointerdown', down, opt)
      addEventListener('pointerup', e => {
        if (e.pointerType !== 'mouse') PTR.delete(e.pointerId)
      }, opt)
      addEventListener('pointercancel', e => PTR.delete(e.pointerId), opt)
      addEventListener('blur', reset, opt)
      document.addEventListener('mouseleave', reset, opt)
      if (WAKE) {
        addEventListener('wheel', scrolled, cap)
        addEventListener('keydown', e => {
          if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) scrolled(e)
        }, cap)
      }
      addEventListener('resize', () => {
        resize()
        kick()
      }, opt)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) halt()
        else kick()
      })
      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault()
        halt()
        live = false
      })
      canvas.addEventListener('webglcontextrestored', () => {
        for (const k of Object.keys(T)) delete T[k]
        vw = 0
        vh = 0
        simW = 0
        simH = 0
        LDT = 0
        DTD = true
        LNS = -1
        if (start()) kick()
      })
      raf = requestAnimationFrame(frame)
    }
    if (getComputedStyle(canvas).position === 'fixed') go()
    else addEventListener('load', go, { once: true })
  }
  const text = () => {
    if (!gsap || !ScrollTrigger) return
    const all = (r, s) => [...r.querySelectorAll(s)]
    const TEXT = 'h1, h2, h3, p, cite, small', SLIDES = '#HOME section:nth-of-type(1), .QUOTE, #OFFERS section, #PROFILE'
    const DUR = 1.5, WDUR = 1.25, EASE = 'power3.out', BLUR = 10, LINE = 0.15, WORD = 0.05, QSPR = 1.5, HOLD = 3.5, RISE = 30
    const SCRD = 1.2, HOVD = 0.6, START = 'top 75%', END = 'clamp(top 50%)', NUM = /^\+?\d+$/
    const GLYPH = String.raw`!"#$%&'()*+,-./:;<=>?@[\]^_` + '`{|}~'
    const SYN = {
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
    const WAITING = [], SLOTS = [], CREW = [], PR = { v: 0 }, POOL = new Uint8Array(500), CVX = document.createElement('canvas').getContext('2d')
    let woke = false, pick = POOL.length, CYC = 0, DRIVE = null
    const wake = () => {
      if (woke) return
      woke = true
      for (const f of WAITING) f()
      WAITING.length = 0
    }
    for (const e of ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'keydown']) addEventListener(e, wake, { passive: true, once: true })
    const trim = raw => {
      const lead = raw.slice(0, raw.length - raw.trimStart().length)
      const tail = raw.slice(raw.trimEnd().length)
      return [lead, raw.slice(lead.length, raw.length - tail.length), tail]
    }
    const unit = t => {
      const sp = document.createElement('span')
      sp.className = 'W'
      sp.textContent = t
      return sp
    }
    const chunk = (n, out) => {
      const f = document.createDocumentFragment()
      for (const part of n.nodeValue.split(/(\s+)/)) {
        if (!part) continue
        const sp = part.trim() ? unit(part) : document.createTextNode(part)
        if (sp.nodeType === 1) out.push(sp)
        f.append(sp)
      }
      n.replaceWith(f)
    }
    const words = el => {
      const out = [], nodes = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) nodes.push(w.currentNode)
      for (const n of nodes) {
        const mk = n.parentElement.closest('mark[outline]')
        if (mk) {
          if (out.at(-1) !== mk) out.push(mk)
        } else if (n.nodeValue.trim()) chunk(n, out)
      }
      return out
    }
    const lines = (ws, sp) => {
      const off = []
      let top = -1e9, n = -1, k = 0, m = 0
      for (const w of ws) {
        const r = w.getBoundingClientRect()
        if (r.top > top + r.height * 0.5) {
          n++
          k = 0
          top = r.top
        }
        const v = n * LINE + k++ * WORD
        m = Math.max(m, v)
        off.push(v)
      }
      return m > 0 ? off.map(v => v / m * sp) : off
    }
    const gauge = (el, txt, w) => {
      const cs = getComputedStyle(el), f = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      CVX.font = f
      return { f, s: txt.length ? (w - CVX.measureText(txt).width) / txt.length : 0, w }
    }
    const cw = (m, s) => {
      CVX.font = m.f
      return CVX.measureText(s).width + s.length * m.s
    }
    const glyph = () => {
      if (pick >= POOL.length) {
        crypto.getRandomValues(POOL)
        pick = 0
      }
      return GLYPH.charAt(POOL[pick++] % GLYPH.length)
    }
    const mix = (a, b, p, m) => {
      const L = Math.round(a.length + (b.length - a.length) * p)
      const lock = Math.min(L, Math.floor(b.length * Math.max(0, (p - 0.4) / 0.6)))
      const keep = Math.max(0, Math.min(a.length - Math.ceil(a.length * Math.min(1, p / 0.4)), L - lock))
      const head = b.slice(0, lock), tail = keep ? a.slice(a.length - keep) : ''
      const A = cw(m, a), W = Math.min(m.w, A + (cw(m, b) - A) * p)
      let g = ''
      for (let i = Math.max(0, L - lock - keep); i > 0 && cw(m, head + g + tail) < W; i--) g += glyph()
      while (g && cw(m, head + g + tail) > W) g = g.slice(0, -1)
      return head + g + tail
    }
    const wrap = el => {
      const tn = el.firstChild
      if (tn?.nodeType !== 3 || el.childNodes.length !== 1) return el
      const [lead, txt, tail] = trim(tn.nodeValue), sp = unit(txt)
      el.textContent = ''
      el.append(...[lead, sp, tail].filter(Boolean))
      return sp
    }
    const unstyle = (el, ...ps) => {
      for (const p of ps) el.style.removeProperty(p)
    }
    const hover = el => {
      let units = all(el, '.W'), busy = false
      if (!units.length) units = [wrap(el)]
      el.addEventListener('mouseenter', () => {
        if (busy) return
        busy = true
        let done = 0
        for (const [i, u] of units.entries()) {
          const raw = u.textContent, [lead, txt, tail] = trim(raw), pr = { v: 0 }, tn = u.firstChild, rg = document.createRange()
          if (tn?.nodeType === 3 && u.childNodes.length === 1) {
            rg.setStart(tn, lead.length)
            rg.setEnd(tn, lead.length + txt.length)
          } else rg.selectNodeContents(u)
          const m = gauge(u, txt, rg.getBoundingClientRect().width)
          Object.assign(u.style, { boxSizing: 'border-box', width: u.getBoundingClientRect().width + 'px', whiteSpace: 'nowrap' })
          gsap.fromTo(pr, { v: 0 }, {
            v: 1,
            duration: HOVD,
            ease: 'none',
            delay: i * WORD,
            onUpdate: () => {
              u.textContent = lead + mix(txt, txt, pr.v, m) + tail
            },
            onComplete: () => {
              u.textContent = raw
              unstyle(u, 'width', 'white-space', 'box-sizing')
              if (++done === units.length) busy = false
            }
          })
        }
        gsap.fromTo(units, { filter: 'blur(0px)' }, { filter: `blur(${BLUR / 5}px)`, duration: HOVD / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, onComplete: () => { for (const u of units) unstyle(u, 'filter') } })
      })
    }
    const slot = (mk, seq, now) => {
      let w = 0, t0 = seq[0]
      for (const t of seq) {
        mk.textContent = t
        const r = mk.getBoundingClientRect().width
        if (r > w) {
          w = r
          t0 = t
        }
      }
      mk.M = gauge(mk, t0, w)
      mk.WIDE = t0
      mk.textContent = now
      mk.setAttribute('outline', now)
    }
    const span = (mk, t) => {
      const was = mk.textContent, pin = mk.style.width
      unstyle(mk, 'width')
      mk.textContent = t
      const w = mk.getBoundingClientRect().width
      mk.textContent = was
      if (pin) mk.style.width = pin
      return w
    }
    const tally = s => {
      const el = s.t[0], was = el.textContent
      unstyle(el, 'min-width')
      el.textContent = s.pre + '9'.repeat(String(s.end).length)
      el.style.minWidth = el.getBoundingClientRect().width + 'px'
      el.textContent = was
    }
    const reserve = p => {
      if (!p) return
      const ms = all(p, 'mark'), was = ms.map(m => m.textContent)
      unstyle(p, 'min-width')
      for (const m of ms) m.textContent = m.WIDE || m.textContent
      const w = p.getBoundingClientRect().width
      for (const [i, m] of ms.entries()) m.textContent = was[i]
      p.style.minWidth = w + 'px'
    }
    const seed = c => {
      if (c.set) return
      c.set = true
      document.fonts.ready.then(() => {
        SLOTS.push(c)
        slot(c.mk, c.seq, c.seq[c.n])
        reserve(c.P)
      })
    }
    const label = (mk, t) => {
      mk.textContent = t
      mk.setAttribute('outline', t)
    }
    const turn = () => {
      CYC++
      for (const c of CREW) {
        c.on = c.st.isActive
        if (!c.on) continue
        if (!c.mk.M) {
          seed(c)
          continue
        }
        c.cyc = CYC
        c.from = c.seq[c.n]
        c.n = (c.n + 1) % c.seq.length
        c.to = c.seq[c.n]
        c.w0 = span(c.mk, c.from)
        c.w1 = span(c.mk, c.to)
        gsap.fromTo(c.mk, { filter: 'blur(0px)' }, { filter: `blur(${BLUR / 2}px)`, duration: SCRD / 2, ease: 'sine.inOut', yoyo: true, repeat: 1, onComplete: () => unstyle(c.mk, 'filter') })
      }
    }
    const paint = () => {
      for (const c of CREW) {
        if (c.cyc !== CYC) continue
        label(c.mk, mix(c.from, c.to, PR.v, c.mk.M))
        c.mk.style.width = c.w0 + (c.w1 - c.w0) * PR.v + 'px'
      }
    }
    const land = () => {
      for (const c of CREW) {
        if (c.cyc !== CYC) continue
        label(c.mk, c.to)
        unstyle(c.mk, 'width')
      }
    }
    const drive = () => {
      DRIVE ??= gsap.fromTo(PR, { v: 0 }, {
        v: 1,
        duration: SCRD,
        ease: 'none',
        delay: HOLD,
        repeat: -1,
        repeatDelay: HOLD,
        onStart: turn,
        onUpdate: paint,
        onRepeat: () => {
          land()
          turn()
        }
      })
    }
    const swap = mk => {
      const w = mk.textContent.trim(), seq = [w, ...(SYN[w.toLowerCase()] ?? [])]
      if (seq.length < 2) return
      const c = { mk, seq, P: mk.closest('h1,h2,h3,p'), n: 0, on: false, cyc: -1, st: ScrollTrigger.create({ trigger: mk, start: START, end: 'bottom top' }) }
      CREW.push(c)
      seed(c)
      if (woke) drive()
      else WAITING.push(drive)
    }
    const trig = el => ({ trigger: el, start: START, once: true })
    const sets = all(document, TEXT)
      .filter(t => !t.parentElement.closest(TEXT) && (t.closest('.QUOTE') || (t.tagName === 'P' && NUM.test(t.textContent.trim()))))
      .map(t => {
        const raw = t.textContent.trim(), s = { el: t }
        if (t.tagName === 'P' && NUM.test(raw)) {
          s.pre = raw.startsWith('+') ? '+' : ''
          s.end = Number.parseInt(raw, 10)
          s.t = [t]
          tally(s)
          t.textContent = s.pre + '0'
        } else s.t = words(t)
        return s
      })
    for (const s of sets) gsap.set(s.t, { opacity: 0 })
    addEventListener('resize', () => {
      for (const s of SLOTS) {
        slot(s.mk, s.seq, s.mk.textContent)
        reserve(s.P)
      }
      for (const s of sets) if (s.end !== undefined) tally(s)
    }, { passive: true })
    for (const b of all(document, SLIDES)) {
      gsap.set(b, { opacity: 0 })
      gsap.fromTo(b, { y: RISE, opacity: 0 }, { y: 0, opacity: 1, duration: DUR, ease: EASE, clearProps: 'all', immediateRender: false, scrollTrigger: trig(b) })
    }
    for (const m of all(document, 'mark[outline]')) swap(m)
    for (const el of all(document, 'a, button')) hover(el)
    const navKids = all(document, 'nav > a, nav > button')
    if (navKids.length) gsap.fromTo(navKids, { opacity: 0, y: RISE }, { opacity: 1, y: 0, duration: DUR, ease: EASE, delay: 0.15, stagger: 0.15, clearProps: 'all' })
    document.fonts.ready.then(() => {
      for (const s of sets) {
        if (!s.t.length) continue
        const L = lines(s.t, QSPR)
        if (s.end === undefined) {
          gsap.fromTo(s.t, { opacity: 0 }, { opacity: 1, duration: WDUR, ease: 'none', stagger: i => L[i], scrollTrigger: { trigger: s.el, start: `clamp(${START})`, end: END, scrub: true } })
          continue
        }
        tally(s)
        s.tw = gsap.fromTo(s.t, { opacity: 0 }, {
          opacity: 1,
          duration: DUR,
          ease: EASE,
          clearProps: 'opacity',
          scrollTrigger: trig(s.el),
          onUpdate: () => {
            if (s.tw) s.el.textContent = s.pre + Math.round(s.tw.ratio * s.end)
          }
        })
      }
      ScrollTrigger.refresh()
    })
    const smoother = ScrollSmoother?.get()
    if (smoother) for (const a of all(document, 'nav a[href^="#"]')) {
      a.addEventListener('click', e => {
        const t = document.querySelector(a.getAttribute('href'))
        if (!t) return
        e.preventDefault()
        smoother.scrollTo(Math.max(0, smoother.offset(t, 'top top') - a.closest('nav').getBoundingClientRect().bottom), true)
      })
    }
  }
  const cal = () => {
    const C = globalThis, d = document, INIT = 'init'
    const q = (a, ar) => {
      a.q.push(ar)
    }
    C.Cal ||= (...ar) => {
      const c = C.Cal
      if (!c.loaded) {
        c.ns = {}
        c.q ||= []
        const js = d.createElement('script')
        js.src = 'https://app.cal.com/embed/embed.js'
        d.head.append(js)
        c.loaded = true
      }
      const ns = ar[1]
      if (ar[0] !== INIT || typeof ns !== 'string') {
        q(c, ar)
        return
      }
      const api = (...a) => {
        q(api, a)
      }
      api.q = []
      c.ns[ns] ||= api
      q(c.ns[ns], ar)
      q(c, ['initNamespace', ns])
    }
    let ready = null, up = false
    const book = fire => {
      if (!ready) {
        C.Cal(INIT, 'booking', { origin: 'https://app.cal.com' })
        C.Cal.config ||= {}
        C.Cal.config.forwardQueryParams = true
        C.Cal.ns.booking('ui', { theme: 'light', cssVarsPerTheme: { light: { 'cal-brand': '#e0e0e0' }, dark: { 'cal-brand': '#000' } }, hideEventTypeDetails: false, layout: 'month_view' })
        const js = d.head.querySelector('script[src^="https://app.cal.com/embed"]')
        ready = js ? new Promise(ok => js.addEventListener('load', ok, { once: true })) : Promise.resolve()
        ready.then(() => {
          up = true
        })
      }
      if (fire) ready.then(() => requestAnimationFrame(() => fire.click()))
    }
    for (const bt of d.querySelectorAll('[data-cal-link]')) {
      for (const ev of ['pointerenter', 'focus', 'touchstart']) bt.addEventListener(ev, () => book(), { passive: true, once: true })
      bt.addEventListener('click', e => {
        if (up) return
        e.preventDefault()
        book(bt)
      })
    }
  }
  fluid()
  text()
  cal()
}
