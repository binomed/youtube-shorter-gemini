import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column('text')
  value: string;
}
