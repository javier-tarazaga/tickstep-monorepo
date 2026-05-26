import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { LabelRepository } from "./label.repository";
import { LabelsController } from "./labels.controller";
import { LabelsService } from "./labels.service";

@Module({
  imports: [AuthModule],
  controllers: [LabelsController],
  providers: [LabelsService, LabelRepository],
  exports: [LabelsService],
})
export class LabelsModule {}
