#!/bin/sh
# Synthesizes a 37s synthwave-style bed (pad + arp + kick + hats) with ffmpeg; no external audio assets.
set -e
SEC=4; R="if(eq(mod(floor(t/$SEC),4),0),0,if(eq(mod(floor(t/$SEC),4),1),-4,if(eq(mod(floor(t/$SEC),4),2),3,-2)))"
W="2*PI*110*pow(2,($R)/12)"
S="if(eq(mod(floor(t*8),4),0),0,if(eq(mod(floor(t*8),4),1),7,if(eq(mod(floor(t*8),4),2),12,19)))"
PAD="0.07*(sin($W*t)+sin($W*1.5*t)+0.5*sin($W*2*t))*(0.75+0.25*sin(2*PI*0.2*t))"
ARP="gte(t,3.6)*lt(t,34)*0.05*sin(2*PI*440*pow(2,(($R)+($S))/12)*t)*exp(-14*mod(t,0.125))"
KICK="gte(t,3.6)*lt(t,34.5)*0.6*sin(2*PI*(45+120*exp(-35*mod(t,0.5)))*mod(t,0.5))*exp(-8*mod(t,0.5))"
HAT="gte(t,9.2)*lt(t,34)*0.035*(2*random(0)-1)*exp(-70*mod(t+0.25,0.5))"
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='$PAD+$ARP+$KICK+$HAT':s=48000:d=37" \
  -af "aecho=0.8:0.6:180|360:0.25|0.12,lowpass=f=9000,afade=t=in:d=1.5,afade=t=out:st=34:d=3,loudnorm=I=-16" \
  -ar 48000 -ac 2 public/soundtrack.wav
