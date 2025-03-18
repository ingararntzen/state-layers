import * as srcprop from "./api_srcprop.js";



export class VariableLayer {


    constructor (variableProvider) {

        // setup src propterty
        srcprop.addToInstance(this);
        this.srcprop_register("src");

        // index
        this.index;

        // initialize
        this.src = variableProvider;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(is_variable_provider(src))) {
                throw new Error(`"src" must be variable provider ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndex(this.src);
            } 
            if (eArg != "reset") {
                this.index.refresh(eArg);
            }
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }

}
srcprop.addToPrototype(VariableLayer.prototype);