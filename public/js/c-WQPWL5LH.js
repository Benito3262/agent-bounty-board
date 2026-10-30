import"./c-YRVRXMGR.js";import"./c-7IAQDIJU.js";import"./c-TE7HTTVY.js";import"./c-JNTQZVFT.js";import"./c-AFGKFHDQ.js";import"./c-656EL6GG.js";import"./c-MWYSZKNB.js";import{B as a,L as p,s as c,v as m}from"./c-YRFMDOKV.js";import"./c-BLX4OB5V.js";import"./c-VPUL5OLH.js";import"./c-7WDA377R.js";import"./c-MIHLHKS3.js";import"./c-TWBXTA37.js";import"./c-257ZUZKA.js";import"./c-E4CHPVWU.js";import"./c-F374CPKI.js";import"./c-AAVHARQH.js";import"./c-H6VVANFK.js";var w=c`
  :host > wui-flex:first-child {
    height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  :host > wui-flex:first-child::-webkit-scrollbar {
    display: none;
  }
`;var u=function(o,e,i,r){var l=arguments.length,t=l<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")t=Reflect.decorate(o,e,i,r);else for(var f=o.length-1;f>=0;f--)(n=o[f])&&(t=(l<3?n(t):l>3?n(e,i,t):n(e,i))||t);return l>3&&t&&Object.defineProperty(e,i,t),t},s=class extends a{render(){return m`
      <wui-flex flexDirection="column" .padding=${["0","3","3","3"]} gap="3">
        <w3m-activity-list page="activity"></w3m-activity-list>
      </wui-flex>
    `}};s.styles=w;s=u([p("w3m-transactions-view")],s);export{s as W3mTransactionsView};
