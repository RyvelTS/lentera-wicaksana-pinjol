import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanResults } from './loan-results';

describe('LoanResults', () => {
  let component: LoanResults;
  let fixture: ComponentFixture<LoanResults>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanResults]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanResults);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
