import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultimodalChat } from './multimodal-chat';

describe('MultimodalChat', () => {
  let component: MultimodalChat;
  let fixture: ComponentFixture<MultimodalChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultimodalChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MultimodalChat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
