// World distances are metres in the city simulation; rendering scales them to pixels.
export const CITY = Object.freeze({width:2560,height:2240,block:320,road:88,coast:2240});
export const CAR = Object.freeze({length:42,width:22,maxSpeed:310,acceleration:190,brake:270,steer:2.7,drag:0.65});
export const PEDESTRIAN = Object.freeze({speed:28,count:100});
export const PLAYER = Object.freeze({walk:110,run:185,radius:9,maxHealth:100});
export const SAVE_KEY = 'port-delmar-save-v1';
export const STEP = 1/60;
export const COLORS = Object.freeze({ink:'#112d3b',paper:'#fff0cc',mint:'#7ff1c5',coral:'#ff765f',gold:'#ffcd61',water:'#227e91'});
export const MISSION_POINTS = Object.freeze({garage:{x:480,y:392},package:{x:1120,y:712},drop:{x:1760,y:1032},courier:{x:1440,y:1072},dock:{x:2080,y:1672},safe:{x:800,y:1672}});
