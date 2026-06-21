<?php

namespace App\Filament\Resources\SubscriptionTierResource\Pages;

use App\Filament\Resources\SubscriptionTierResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditSubscriptionTier extends EditRecord
{
    protected static string $resource = SubscriptionTierResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
