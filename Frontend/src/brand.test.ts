import {describe,it,expect} from 'vitest';
describe('CampusSphere brand',()=>{it('uses the CampusSphere title',async()=>{const html=await import('../index.html?raw');expect(html.default).toContain('CampusSphere');expect(html.default).toContain('Your campus. Your community.');});});
