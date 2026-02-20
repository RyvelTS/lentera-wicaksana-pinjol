import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanForm } from './loan-form';

describe('LoanForm', () => {
  let component: LoanForm;
  let fixture: ComponentFixture<LoanForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
