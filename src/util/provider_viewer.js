import {endpoint} from "./intervals.js";

/*
    State Provider Viewer
*/

function item2string(item, options) {
    // txt
    const id_txt = item.id;
    const type_txt = item.type;
    let itv_txt = "";
    if (item.itv != undefined) {
        const [low, high, lowInclude, highInclude] = item.itv;
        const low_txt = (low == null) ? "null" : low.toFixed(2);
        const high_txt = (high == null) ? "null" : high.toFixed(2);
        itv_txt = `[${low_txt},${high_txt},${lowInclude},${highInclude}]`; 
    }
    let data_txt = JSON.stringify(item.data);

    // html
    let id_html = `<span class="item-id">${id_txt}</span>`;
    let itv_html = `<span class="item-itv">${itv_txt}</span>`;
    let type_html = `<span class="item-type">${type_txt}</span>`
    let data_html = `<span class="item-data">${data_txt}</span>`;
    
    // delete Button
    const {delete_allowed=false} = options;
    if (delete_allowed) {
        return `
        <div>
            <button id="delete">X</button>
            ${id_html}: ${type_html} ${itv_html} ${data_html}
        </div>`;
    } else {
        return `
        <div>
            ${id_html}: ${type_html} ${itv_html} ${data_html}
        </div>`;        
    }
}


export class StateProviderViewer {

    constructor(stateProvider, elem, options={}) {
        this._sp = stateProvider;
        this._elem = elem;
        this._handle = this._sp.add_callback(this._onchange.bind(this)); 

        // options
        let defaults = {
            toString:item2string
        };
        this._options = {...defaults, ...options};

        /*
            Support delete
        */
        if (this._options.delete_allowed) {
            // listen for click events on root element
            elem.addEventListener("click", (e) => {
                // catch click event from delete button
                const deleteBtn = e.target.closest("#delete");
                if (deleteBtn) {
                    const listItem = deleteBtn.closest(".list-item");
                    if (listItem) {
                        this._sp.update({remove:[listItem.id]});
                        e.stopPropagation();
                    }
                }
            });
        }

        /*
            render initial state
        */ 
        this._onchange();
    }

    _onchange() {
        const items = this._sp.get();

        // sort by low endpoint
        items.sort((item_a, item_b) => {
            let lowEp_a = endpoint.from_interval(item_a.itv)[0];
            let lowEp_b = endpoint.from_interval(item_b.itv)[0];
            return endpoint.cmp(lowEp_a, lowEp_b);
        });

        // clear
        this._elem.replaceChildren();
        // rebuild
        const {toString} = this._options;
        for (let item of items) {
            // add
            let node = this._elem.querySelector(`#${item.id}`);
            if (node == null) {
                node = document.createElement("div");
                node.setAttribute("id", item.id);
                node.classList.add("list-item");
                this._elem.appendChild(node);
            }
            node.innerHTML = toString(item, this._options);
        }
    }
}
