export type MT5GatewayMode="READ_ONLY"|"DISABLED";
export type MT5ReadOnlyStatus={mode:MT5GatewayMode;connected:false;broker:null;account:null;executionEnabled:false;reason:"gateway-contract-only"};
export function getMT5ReadOnlyStatus():MT5ReadOnlyStatus{return{mode:"READ_ONLY",connected:false,broker:null,account:null,executionEnabled:false,reason:"gateway-contract-only"};}