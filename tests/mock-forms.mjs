export const forms=[];
export const responses=[];
export class ActionFormData {
 buttons=[];
 title(value){this.heading=value;return this;}
 body(value){this.content=value;return this;}
 button(label,icon){this.buttons.push({label,icon});return this;}
 show(player){forms.push({player,form:this});const response=responses.shift();return typeof response==='function'?response():Promise.resolve(response??{canceled:true});}
}
