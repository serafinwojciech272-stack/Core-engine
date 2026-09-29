import {describe,it,expect} from "vitest";
import {calculateCommercialValue} from "@/lib/commercial-value";

describe("commercial value ledger",()=>{
  it("keeps baseline and actual distinct and calculates ROI only with an investment",()=>{
    const result=calculateCommercialValue({baselineValue:10000,targetValue:12000,actualValue:13000,investmentValue:1000});
    expect(result.valueDelta).toBe(3000);
    expect(result.roiPct).toBe(200);
    expect(result.quality).toBe("VERIFIED");
  });
  it("does not invent ROI before an actual outcome exists",()=>{
    const result=calculateCommercialValue({baselineValue:10000,targetValue:12000,investmentValue:1000});
    expect(result.valueDelta).toBeNull();
    expect(result.roiPct).toBeNull();
    expect(result.quality).toBe("UNVERIFIED");
  });
  it("keeps zero-investment cases without a fake ROI percentage",()=>{
    const result=calculateCommercialValue({baselineValue:10000,actualValue:11000,investmentValue:0});
    expect(result.valueDelta).toBe(1000);
    expect(result.roiPct).toBeNull();
  });
});
